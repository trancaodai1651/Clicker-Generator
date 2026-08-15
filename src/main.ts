import './style.css';
import { bootstrapApp } from './app/controller';

const flexKeychain = new URLSearchParams(window.location.search).get('page') === 'flex-keychain'
  || window.location.hash === '#flex-keychain';
const flexOrganizer = new URLSearchParams(window.location.search).get('page') === 'flex-organizer'
  || window.location.hash === '#flex-organizer';

if (flexOrganizer) {
  void import('./features/flexOrganizer/controller').then(({ bootstrapFlexOrganizer }) => bootstrapFlexOrganizer());
} else if (flexKeychain) {
  void import('./features/flexKeychain/controller').then(({ bootstrapFlexKeychain }) => bootstrapFlexKeychain());
} else {
  bootstrapApp();
}
