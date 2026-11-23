export type MobilityCatalogFeed = {
  id: string;
  dataType: string;
  status: string;
  provider: string;
  name: string;
  countryCode: string;
  subdivisionName: string;
  municipality: string;
  latestUrl: string;
  licenseUrl: string;
  authenticationType: string;
  isOfficial: boolean | null;
};

export type BusFeedCandidate = MobilityCatalogFeed & {
  discoverySource: "mobility-database";
  reviewStatus: "requires_gtfs_route_type_validation";
};

const CATALOG_URL = "https://files.mobilitydatabase.org/feeds_v2.csv";
const CACHE_TTL_MS = 30 * 60 * 1000;
let cachedCatalog: { expiresAt: number; feeds: MobilityCatalogFeed[] } | undefined;

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some(value => value !== "")) rows.push(row);
  }
  return rows;
}

function value(record: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const found = record[key]?.trim();
    if (found) return found;
  }
  return "";
}

export function parseMobilityDatabaseCsv(csv: string): MobilityCatalogFeed[] {
  const [rawHeaders, ...rows] = parseCsv(csv);
  if (!rawHeaders?.length) return [];
  const headers = rawHeaders.map(header => header.trim().replace(/^\uFEFF/, ""));

  return rows.map(columns => {
    const record = Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ""]));
    const officialValue = value(record, "is_official").toLowerCase();
    const authType = value(record, "urls.authentication_type", "authentication_type");
    return {
      id: value(record, "id", "mdb_source_id"),
      dataType: value(record, "data_type").toLowerCase(),
      status: value(record, "status").toLowerCase() || "active",
      provider: value(record, "provider"),
      name: value(record, "name"),
      countryCode: value(record, "location.country_code", "country_code").toUpperCase(),
      subdivisionName: value(record, "location.subdivision_name", "subdivision_name"),
      municipality: value(record, "location.municipality", "municipality"),
      latestUrl: value(record, "urls.latest", "latest"),
      licenseUrl: value(record, "urls.license", "license", "urls.license_url"),
      authenticationType: authType || "0",
      isOfficial: officialValue === "true" ? true : officialValue === "false" ? false : null,
    };
  }).filter(feed => Boolean(feed.id));
}

export async function discoverMobilityDatabaseBusCandidates(options: {
  countryCode?: string;
  subdivisionName?: string;
  municipality?: string;
} = {}): Promise<BusFeedCandidate[]> {
  const catalog = await getMobilityCatalog();
  const countryCode = options.countryCode?.trim().toUpperCase();
  const subdivision = options.subdivisionName?.trim().toLowerCase();
  const municipality = options.municipality?.trim().toLowerCase();

  return catalog
    .filter(feed => feed.dataType === "gtfs" && feed.status === "active")
    .filter(feed => !countryCode || feed.countryCode === countryCode)
    .filter(feed => !subdivision || feed.subdivisionName.toLowerCase().includes(subdivision))
    .filter(feed => !municipality || feed.municipality.toLowerCase().includes(municipality))
    .filter(feed => Boolean(feed.latestUrl))
    .map(feed => ({
      ...feed,
      discoverySource: "mobility-database" as const,
      reviewStatus: "requires_gtfs_route_type_validation" as const,
    }));
}

async function getMobilityCatalog(): Promise<MobilityCatalogFeed[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.feeds;
  const response = await fetch(CATALOG_URL, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "TripsForge/1.0 (public transit feed discovery)" },
  });
  if (!response.ok) throw new Error(`MOBILITY_CATALOG_HTTP_${response.status}`);
  const feeds = parseMobilityDatabaseCsv(await response.text());
  if (!feeds.length) throw new Error("MOBILITY_CATALOG_EMPTY_OR_INVALID");
  cachedCatalog = { feeds, expiresAt: Date.now() + CACHE_TTL_MS };
  return feeds;
}
