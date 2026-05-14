import type { PropsWithChildren } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconFilterAll } from '@/components/ui/icons';
import { AUTH_FILES_SORT_OPTIONS, type AuthFilesSortMode } from '@/features/authFiles/authFilesManagerPageAdapter';
import { MAX_CARD_PAGE_SIZE, MIN_CARD_PAGE_SIZE, getAuthFileIcon, getTypeColor } from '@/features/authFiles/constants';
import styles from '@/pages/AuthFilesPage.module.scss';

const formatTypeLabel = (type: string): string => {
  if (type.toLowerCase() === 'iflow') return 'iFlow';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

interface AuthFilesManagerFilterSectionProps {
  compactMode: boolean;
  disabledOnly: boolean;
  existingTypes: string[];
  filter: string;
  pageSizeInput: string;
  problemOnly: boolean;
  search: string;
  sortMode: AuthFilesSortMode;
  typeCounts: Record<string, number>;
  commitPageSizeInput: (value: string) => void;
  handlePageSizeChange: (value: string) => void;
  setCompactMode: Dispatch<SetStateAction<boolean>>;
  setDisabledOnly: Dispatch<SetStateAction<boolean>>;
  setFilter: Dispatch<SetStateAction<string>>;
  setPage: Dispatch<SetStateAction<number>>;
  setProblemOnly: Dispatch<SetStateAction<boolean>>;
  setSearch: Dispatch<SetStateAction<string>>;
  setSortMode: Dispatch<SetStateAction<AuthFilesSortMode>>;
}

export function AuthFilesManagerFilterSection({
  children,
  compactMode,
  disabledOnly,
  existingTypes,
  filter,
  pageSizeInput,
  problemOnly,
  search,
  sortMode,
  typeCounts,
  commitPageSizeInput,
  handlePageSizeChange,
  setCompactMode,
  setDisabledOnly,
  setFilter,
  setPage,
  setProblemOnly,
  setSearch,
  setSortMode
}: PropsWithChildren<AuthFilesManagerFilterSectionProps>) {
  return (
    <div className={styles.filterSection}>
      <div className={styles.filterRail}>
        <div className={styles.filterTags}>
          {existingTypes.map(type => {
            const active = filter === type;
            const iconSrc = getAuthFileIcon(type, 'light');
            const color =
              type === 'all' ? { bg: 'var(--bg-tertiary)', text: 'var(--text-primary)' } : getTypeColor(type, 'light');
            return (
              <button
                className={`${styles.filterTag} ${active ? styles.filterTagActive : ''}`}
                key={type}
                style={
                  {
                    '--filter-color': color.text,
                    '--filter-surface': color.bg,
                    '--filter-active-text': '#ffffff'
                  } as CSSProperties
                }
                type="button"
                onClick={() => {
                  setFilter(type);
                  setPage(1);
                }}
              >
                <span className={styles.filterTagLabel}>
                  {type === 'all' ? (
                    <span className={`${styles.filterTagIconWrap} ${styles.filterAllIconWrap}`}>
                      <IconFilterAll className={styles.filterAllIcon} size={16} />
                    </span>
                  ) : (
                    <span className={styles.filterTagIconWrap}>
                      {iconSrc ? (
                        <img src={iconSrc} alt="" className={styles.filterTagIcon} />
                      ) : (
                        <span className={styles.filterTagIconFallback}>
                          {formatTypeLabel(type).slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                  )}
                  <span className={styles.filterTagText}>{type === 'all' ? '全部' : formatTypeLabel(type)}</span>
                </span>
                <span className={styles.filterTagCount}>{typeCounts[type] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.filterContent}>
        <div className={styles.filterControlsPanel}>
          <div className={styles.filterControls}>
            <div className={styles.filterItem}>
              <label>搜索配置文件</label>
              <Input
                value={search}
                onChange={event => {
                  setSearch(event.currentTarget.value);
                  setPage(1);
                }}
                placeholder="输入名称、类型或提供方关键字"
              />
            </div>
            <div className={styles.filterItem}>
              <label>单页数量</label>
              <input
                className={styles.pageSizeSelect}
                type="number"
                min={MIN_CARD_PAGE_SIZE}
                max={MAX_CARD_PAGE_SIZE}
                step={1}
                value={pageSizeInput}
                onBlur={event => commitPageSizeInput(event.currentTarget.value)}
                onChange={event => handlePageSizeChange(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
            <div className={styles.filterItem}>
              <label>排序</label>
              <Select
                className={styles.sortSelect}
                value={sortMode}
                fullWidth
                ariaLabel="排序"
                onChange={value => {
                  setSortMode(value as AuthFilesSortMode);
                  setPage(1);
                }}
                options={AUTH_FILES_SORT_OPTIONS}
              />
            </div>
            <div className={`${styles.filterItem} ${styles.filterToggleItem}`}>
              <label>显示选项</label>
              <div className={styles.filterToggleGroup}>
                <div className={styles.filterToggleCard}>
                  <ToggleSwitch
                    checked={problemOnly}
                    onChange={value => {
                      setProblemOnly(value);
                      setPage(1);
                    }}
                    ariaLabel="仅显示有问题凭证"
                    label={<span className={styles.filterToggleLabel}>仅显示有问题凭证</span>}
                  />
                </div>
                <div className={styles.filterToggleCard}>
                  <ToggleSwitch
                    checked={disabledOnly}
                    onChange={value => {
                      setDisabledOnly(value);
                      setPage(1);
                    }}
                    ariaLabel="仅显示已停用凭证"
                    label={<span className={styles.filterToggleLabel}>仅显示已停用凭证</span>}
                  />
                </div>
                <div className={styles.filterToggleCard}>
                  <ToggleSwitch
                    checked={compactMode}
                    onChange={value => setCompactMode(value)}
                    ariaLabel="简略模式"
                    label={<span className={styles.filterToggleLabel}>简略模式</span>}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

interface AuthFilesManagerPaginationProps {
  currentPage: number;
  pageSize: number;
  setPage: Dispatch<SetStateAction<number>>;
  sortedLength: number;
  totalPages: number;
}

export function AuthFilesManagerPagination({
  currentPage,
  pageSize,
  setPage,
  sortedLength,
  totalPages
}: AuthFilesManagerPaginationProps) {
  if (sortedLength <= pageSize) return null;

  return (
    <div className={styles.pagination}>
      <Button
        variant="secondary"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => setPage(Math.max(1, currentPage - 1))}
      >
        上一页
      </Button>
      <div className={styles.pageInfo}>
        第 {currentPage} / {totalPages} 页，共 {sortedLength} 项
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
      >
        下一页
      </Button>
    </div>
  );
}
