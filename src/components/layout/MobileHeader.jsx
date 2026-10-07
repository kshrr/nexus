import { Wordmark } from './Wordmark';
import { SignOutButton } from './SignOutButton';

/**
 * Compact header shown below 1280px, where the side rail is hidden. Carries the
 * wordmark and sign out; primary navigation is the bottom tab bar.
 */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-pine-100 bg-surface/95 px-4 backdrop-blur lg:hidden">
      <Wordmark />
      <SignOutButton />
    </header>
  );
}

export default MobileHeader;
