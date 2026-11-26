/**
 * Decisions of the "What's new" pop-up, kept pure so they can be tested without a browser.
 * The component (src/components/whatsNew/WhatsNewModal.tsx) only wires them to the DOM.
 */

/** Open only when the person has not dismissed this version for good and we have not shown it in this sign-in session yet. */
export function shouldOpenPopup({ dismissed, shownThisSession }: { dismissed: boolean; shownThisSession: boolean }): boolean {
  return !dismissed && !shownThisSession;
}

/** Closing writes to the database only when "Don't show again" is checked; otherwise nothing is saved. */
export function shouldPersistDismissal({ checkboxChecked }: { checkboxChecked: boolean }): boolean {
  return checkboxChecked;
}

/** sessionStorage key of the "already shown" flag: per sign-in session (Better Auth session id) and version. */
export function shownFlagKey(sessionId: string, version: string): string {
  return `agentsdr:whatsNew:shown:${sessionId}:${version}`;
}
