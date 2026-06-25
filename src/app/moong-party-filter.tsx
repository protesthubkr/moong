"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

export type MoongPartyFilterOption = {
  accentColor: string;
  key: string;
  label: string;
  logoSrc: string | null;
};

const PARTY_FILTER_STORAGE_KEY = "moong:party-filter:hidden-parties:v1";

export function MoongPartyFilter({
  options,
}: {
  options: MoongPartyFilterOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hiddenPartyKeys, setHiddenPartyKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [draftHiddenPartyKeys, setDraftHiddenPartyKeys] =
    useState<ReadonlySet<string>>(() => new Set());
  const optionKeys = useMemo(() => options.map((option) => option.key), [options]);
  const optionKeySet = useMemo(() => new Set(optionKeys), [optionKeys]);
  const hiddenCount = hiddenPartyKeys.size;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedHiddenKeys = readStoredHiddenPartyKeys(optionKeySet, options);

      if (!storedHiddenKeys) {
        return;
      }

      setHiddenPartyKeys(storedHiddenKeys);
      setDraftHiddenPartyKeys(storedHiddenKeys);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [optionKeySet, options]);

  useEffect(() => {
    applyPartyFilter(hiddenPartyKeys);

    const root = document.querySelector(".moong-feed-window");

    if (!root) {
      return;
    }

    const observer = new MutationObserver(() => {
      applyPartyFilter(hiddenPartyKeys);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [hiddenPartyKeys]);

  const openFilter = useCallback(() => {
    setDraftHiddenPartyKeys(new Set(hiddenPartyKeys));
    setIsOpen(true);
  }, [hiddenPartyKeys]);

  const closeFilter = useCallback(() => {
    setIsOpen(false);
  }, []);

  const applyFilter = useCallback(() => {
    const nextHiddenPartyKeys = isEveryPartyHidden(draftHiddenPartyKeys, options)
      ? new Set<string>()
      : new Set(draftHiddenPartyKeys);

    setHiddenPartyKeys(nextHiddenPartyKeys);
    writeStoredHiddenPartyKeys(nextHiddenPartyKeys, options);
    setIsOpen(false);
  }, [draftHiddenPartyKeys, options]);

  const toggleAllParties = useCallback(() => {
    setDraftHiddenPartyKeys((current) =>
      current.size === 0 ? new Set(optionKeys) : new Set(),
    );
  }, [optionKeys]);

  const toggleParty = useCallback((key: string) => {
    setDraftHiddenPartyKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }, []);

  if (options.length === 0) {
    return null;
  }

  return (
    <>
      <button
        aria-label="정당 필터 열기"
        className={`moong-party-filter-trigger ${
          hiddenCount > 0 ? "is-active" : ""
        }`}
        onClick={openFilter}
        type="button"
      >
        <Image
          alt=""
          aria-hidden="true"
          className="moong-party-filter-trigger-icon"
          height={24}
          src="/filter.svg"
          width={24}
        />
        {hiddenCount > 0 ? (
          <span className="moong-party-filter-trigger-count">{hiddenCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <MoongPartyFilterSheet
          draftHiddenPartyKeys={draftHiddenPartyKeys}
          onApply={applyFilter}
          onClose={closeFilter}
          onToggleAll={toggleAllParties}
          onToggleParty={toggleParty}
          options={options}
        />
      ) : null}
    </>
  );
}

function MoongPartyFilterSheet({
  draftHiddenPartyKeys,
  onApply,
  onClose,
  onToggleAll,
  onToggleParty,
  options,
}: {
  draftHiddenPartyKeys: ReadonlySet<string>;
  onApply: () => void;
  onClose: () => void;
  onToggleAll: () => void;
  onToggleParty: (key: string) => void;
  options: MoongPartyFilterOption[];
}) {
  const isAllVisible = draftHiddenPartyKeys.size === 0;

  return (
    <div className="moong-party-filter-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="moong-party-filter-title"
        aria-modal="true"
        className="moong-party-filter-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="moong-party-filter-sheet-header">
          <button onClick={onClose} type="button">
            취소
          </button>
          <h1 id="moong-party-filter-title">정당 필터</h1>
          <button onClick={onApply} type="button">
            적용
          </button>
        </div>

        <div className="moong-party-filter-content">
          <div className="moong-party-filter-choice-list">
            <MoongPartyFilterChoiceButton
              checked={isAllVisible}
              label="전체"
              logoSrc={null}
              onToggle={onToggleAll}
            />
            {options.map((option) => (
              <MoongPartyFilterChoiceButton
                checked={!draftHiddenPartyKeys.has(option.key)}
                key={option.key}
                label={option.label}
                logoSrc={option.logoSrc}
                onToggle={() => onToggleParty(option.key)}
                partyKey={option.key}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MoongPartyFilterChoiceButton({
  checked,
  label,
  logoSrc,
  onToggle,
  partyKey,
}: {
  checked: boolean;
  label: string;
  logoSrc: string | null;
  onToggle: () => void;
  partyKey?: string;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`moong-party-filter-choice ${checked ? "is-selected" : ""} ${
        logoSrc ? "has-logo" : "is-text-only is-all"
      }`}
      data-filter-kind={partyKey ? "party" : "all"}
      data-party-key={partyKey}
      style={
        logoSrc
          ? {
              gridTemplateColumns: "30px minmax(0, 1fr) 30px",
              textAlign: "center",
            }
          : {
              gridTemplateColumns: "minmax(0, 1fr)",
              justifyItems: "center",
              textAlign: "center",
            }
      }
      type="button"
      onClick={onToggle}
    >
      {logoSrc ? (
        <span aria-hidden="true" className="moong-party-filter-choice-logo">
          <Image alt="" height={28} src={logoSrc} width={28} />
        </span>
      ) : null}
      <span
        className="moong-party-filter-choice-copy"
        style={{
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        <span className="moong-party-filter-choice-label">{label}</span>
      </span>
    </button>
  );
}

function applyPartyFilter(hiddenPartyKeys: ReadonlySet<string>) {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>(".moong-row[data-moong-party-key]"),
  );

  for (const row of rows) {
    row.hidden = hiddenPartyKeys.has(row.dataset.moongPartyKey ?? "");
  }

  for (const item of Array.from(
    document.querySelectorAll<HTMLElement>(".moong-feed-item"),
  )) {
    const itemRows = Array.from(
      item.querySelectorAll<HTMLElement>(".moong-row[data-moong-party-key]"),
    );

    item.hidden = itemRows.length > 0 && itemRows.every((row) => row.hidden);
  }
}

function isEveryPartyHidden(
  hiddenPartyKeys: ReadonlySet<string>,
  options: MoongPartyFilterOption[],
) {
  return (
    options.length > 0 && options.every((option) => hiddenPartyKeys.has(option.key))
  );
}

function readStoredHiddenPartyKeys(
  optionKeySet: ReadonlySet<string>,
  options: MoongPartyFilterOption[],
) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(PARTY_FILTER_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      hiddenKeys?: unknown;
    };
    const storedKeys = Array.isArray(parsed.hiddenKeys) ? parsed.hiddenKeys : [];
    const hiddenKeys = new Set(
      storedKeys.filter(
        (key): key is string => typeof key === "string" && optionKeySet.has(key),
      ),
    );

    return isEveryPartyHidden(hiddenKeys, options) ? new Set<string>() : hiddenKeys;
  } catch {
    return null;
  }
}

function writeStoredHiddenPartyKeys(
  hiddenPartyKeys: ReadonlySet<string>,
  options: MoongPartyFilterOption[],
) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedHiddenKeys = isEveryPartyHidden(hiddenPartyKeys, options)
    ? []
    : Array.from(hiddenPartyKeys);

  if (normalizedHiddenKeys.length === 0) {
    try {
      window.localStorage.removeItem(PARTY_FILTER_STORAGE_KEY);
    } catch {
      // Storage failures should not disable the in-memory filter.
    }
    return;
  }

  try {
    window.localStorage.setItem(
      PARTY_FILTER_STORAGE_KEY,
      JSON.stringify({
        hiddenKeys: normalizedHiddenKeys,
        updatedAt: new Date().toISOString(),
        version: 1,
      }),
    );
  } catch {
    // Storage failures should not disable the in-memory filter.
  }
}
