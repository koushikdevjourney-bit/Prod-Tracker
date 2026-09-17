export const environment = {
  production: false,
  // Local Mongo DNS often fails (querySrv ECONNREFUSED). Use the hosted API so login works.
  apiUrl: 'https://prod-tracker.onrender.com/api',
};
