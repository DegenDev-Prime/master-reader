/**
 * Type declaration for the Drizzle-generated `migrations.js` bundle.
 * The runtime module is produced by `npm run db:generate`.
 */
declare const migrations: {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
};

export default migrations;
