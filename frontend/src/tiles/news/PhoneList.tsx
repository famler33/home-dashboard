import { useTranslation } from 'react-i18next';
import { HeadlineMeta } from './HeadlineMeta';
import type { Headline } from './headlines';
import type { NewsGroup } from './types';

interface Props {
  headlines: readonly Headline[];
  now: number;
  timeZone: string;
}

const groups: readonly NewsGroup[] = ['local', 'global'];

/** All headlines grouped "Regional" and "Welt"; plain text, no rotation and no links. */
export function PhoneList({ headlines, now, timeZone }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const rows = headlines.filter((headline) => headline.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group} className="flex flex-col gap-1">
            <h3 className="text-caption font-semibold text-ink-muted">
              {t(group === 'local' ? 'news.regional' : 'news.world')}
            </h3>
            <ul className="flex flex-col">
              {rows.map((headline) => (
                <li key={headline.id} className="flex min-h-11 flex-col justify-center py-2">
                  <span className="line-clamp-2 text-body text-ink">{headline.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-caption text-ink-muted">
                    <HeadlineMeta headline={headline} now={now} timeZone={timeZone} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
