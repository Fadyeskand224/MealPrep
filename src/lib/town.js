// Links between the Ems apps. Override at build time with VITE_TOWN_URL / VITE_NOOK_URL if the hosts change.
export const TOWN_URL = (import.meta.env.VITE_TOWN_URL || 'https://emstown.onrender.com') + '?from=meals'; // opens the game with the car parked at EmsMeals
export const NOOK_URL = import.meta.env.VITE_NOOK_URL || 'https://emsnook.onrender.com';
