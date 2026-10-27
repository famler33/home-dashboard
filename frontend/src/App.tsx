import { useTranslation } from 'react-i18next';

export function App() {
  const { t } = useTranslation();
  return <h1 className="p-8 text-display">{t('app.name')}</h1>;
}
