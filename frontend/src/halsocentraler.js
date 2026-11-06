export const HALSOCENTRALER = [
  'Backens hälsocentral',
  'Bjurholms hälsocentral',
  'Capio Hälsocentral Dragonen',
  'Capio Norrlandskliniken',
  'Citymottagningen',
  'Ersboda hälsocentral',
  'Holmsunds hälsocentral',
  'Husläkarna',
  'Hörnefors hälsocentral',
  'Mariehems hälsocentral',
  'Nordmalings hälsocentral',
  'Robertsfors hälsocentral',
  'Sävars hälsocentral',
  'Tegs hälsocentral',
  'Vindelns hälsocentral',
  'Vännäs hälsocentral',
  'Ålidhems hälsocentral'
];

export const HALSOCENTRALER_APPROVAL_KEY = 'approvedHalsocentraler';

export function readApprovedHalsocentraler(storage = globalThis.localStorage) {
  try {
    const approved = JSON.parse(storage?.getItem(HALSOCENTRALER_APPROVAL_KEY) || '[]');
    return Array.isArray(approved) ? approved.filter(name => HALSOCENTRALER.includes(name)) : [];
  } catch {
    return [];
  }
}

export function writeApprovedHalsocentraler(approved, storage = globalThis.localStorage, eventTarget = globalThis.window) {
  const safeApproved = Array.isArray(approved) ? approved.filter(name => HALSOCENTRALER.includes(name)) : [];
  storage?.setItem(HALSOCENTRALER_APPROVAL_KEY, JSON.stringify(safeApproved));
  if (eventTarget && typeof globalThis.CustomEvent === 'function') {
    eventTarget.dispatchEvent(new CustomEvent('halsocentralerApprovalChanged', { detail: safeApproved }));
  }
}
