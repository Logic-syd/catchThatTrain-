import './teaShopIcon.css';

export type TeaShopVariant = 'seal' | 'fan' | 'cup';

const CITY_TEA_STYLE: Record<string, TeaShopVariant> = {
  shanghai: 'seal', beijing: 'seal',
  hangzhou: 'fan', wuhan: 'fan',
  guangzhou: 'cup', zhengzhou: 'cup',
};

/** Decorative tea-house artwork; the surrounding task supplies its accessible name. */
export default function TeaShopIcon({cityId, variant, size = 56, className = ''}: {
  cityId?: string;
  variant?: TeaShopVariant;
  size?: number;
  className?: string;
}) {
  const style = variant ?? (cityId ? CITY_TEA_STYLE[cityId] : undefined) ?? 'seal';
  return <svg className={`tea-shop-icon tea-shop-icon--${style} ${className}`.trim()}
    width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">
    {style === 'seal' && <>
      <circle cx="40" cy="40" r="37" fill="#8E3438"/>
      <circle cx="40" cy="40" r="32.5" stroke="#E5C58D" strokeWidth="1.5"/>
      <path d="M17 30c-3 8-3 16 0 23m46-23c3 8 3 16 0 23" stroke="#E5C58D" strokeWidth="2" strokeLinecap="round"/>
      <path d="M29 60c1-10 7-16 12-19l-1-8 12-4c4 9 1 18-8 20l3 11" fill="#FFF1D4"/>
      <path d="M31 39c-8-8-5-21 6-24 10-2 18 4 18 13l-8-3-5 8-11 6Z" fill="#FFF1D4"/>
      <path d="m49 34 7 5-6 3m-6 6 5 10m-20 2h24" stroke="#FFF1D4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M31 20c-6-5-6-10-2-12 5-1 9 5 8 11" fill="#E5C58D"/>
      <path d="m28 25 21-10" stroke="#E5C58D" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="26" cy="26" r="2.5" fill="#E5C58D"/>
      <path d="M37 67h6" stroke="#E5C58D" strokeWidth="2" strokeLinecap="round"/>
    </>}
    {style === 'fan' && <>
      <rect x="4" y="4" width="72" height="72" rx="23" fill="#F8EAD1" stroke="#C8AA76" strokeWidth="2"/>
      <path d="M11 45c0-18 13-32 29-32s29 14 29 32L40 65 11 45Z" fill="#9A3E42"/>
      <path d="m17 39 23 26-12-43 12 43V17m0 48 12-43-12 43 23-26" stroke="#F2D7AE" strokeWidth="1.5" opacity=".65"/>
      <path d="M29 48c2-7 5-11 9-13l-1-5 9-2c4 7 2 12-4 14l4 7" fill="#FFF4DE"/>
      <path d="M32 33c-5-6-2-14 5-15 8-1 12 4 12 11l-8-2-9 6Z" fill="#FFF4DE"/>
      <path d="m44 32 6 4-5 2m-17 12c7-4 15-4 23 0" stroke="#FFF4DE" strokeWidth="2" strokeLinecap="round"/>
      <path d="m30 24 18-9" stroke="#DAB779" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="m40 65 5 6m-5-6-4 6" stroke="#A98453" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="40" cy="64" r="3.5" fill="#DAB779"/>
    </>}
    {style === 'cup' && <>
      <rect x="4" y="4" width="72" height="72" rx="23" fill="#D98D43"/>
      <path d="m47 10-5 18" stroke="#573D2F" strokeWidth="4" strokeLinecap="round"/>
      <path d="m23 27 4 35c.3 4 4 7 8 7h10c4 0 7.7-3 8-7l4-35" fill="#FFF1D3" stroke="#573D2F" strokeWidth="2.5"/>
      <path d="M21 25h38l2 7H19l2-7Z" fill="#573D2F" stroke="#573D2F" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M28 40h24l-2 18H30l-2-18Z" fill="#8E3438"/>
      <path d="M39 52c-6 0-8-4-8-8 6 0 9 3 8 8Zm1-2c0-6 3-9 9-9 0 6-3 9-9 9Z" fill="#FFE8B9"/>
      <path d="M40 54v-8" stroke="#FFE8B9" strokeWidth="2" strokeLinecap="round"/>
      <path d="m12 18 3 2m48 40 4 2m-3-45-3 3" stroke="#FFE8B9" strokeWidth="2.5" strokeLinecap="round"/>
    </>}
  </svg>;
}
