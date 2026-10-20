// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_small_timeslip.sql';
import m0001 from './0001_wet_warhawk.sql';
import m0002 from './0002_square_mongoose.sql';
import m0003 from './0003_groovy_praxagora.sql';
import m0004 from './0004_uneven_blackheart.sql';
import m0005 from './0005_large_prodigy.sql';
import m0006 from './0006_curved_moon_knight.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006
    }
  }
  