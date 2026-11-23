import { describe, expect, it } from "vitest";
import { parseMobilityDatabaseCsv } from "./mobilityCatalog";

describe("Mobility Database catalog parsing", () => {
  it("parses quoted CSV fields and nested schema columns", () => {
    const csv = [
      "id,data_type,status,is_official,provider,name,location.country_code,location.subdivision_name,location.municipality,urls.latest,urls.license,urls.authentication_type",
      'mdb-1,gtfs,active,True,Transit Agency,"City, Bus Network",IN,Jammu and Kashmir,Jammu,https://example.test/feed.zip,https://example.test/license,0',
    ].join("\n");

    expect(parseMobilityDatabaseCsv(csv)).toEqual([{
      id: "mdb-1",
      dataType: "gtfs",
      status: "active",
      provider: "Transit Agency",
      name: "City, Bus Network",
      countryCode: "IN",
      subdivisionName: "Jammu and Kashmir",
      municipality: "Jammu",
      latestUrl: "https://example.test/feed.zip",
      licenseUrl: "https://example.test/license",
      authenticationType: "0",
      isOfficial: true,
    }]);
  });

  it("defaults missing status and official metadata conservatively", () => {
    const csv = [
      "id,data_type,provider,location.country_code,urls.latest",
      "mdb-2,gtfs,Unknown Agency,IN,https://example.test/feed.zip",
    ].join("\n");
    const [feed] = parseMobilityDatabaseCsv(csv);
    expect(feed.status).toBe("active");
    expect(feed.isOfficial).toBeNull();
  });

  it("ignores rows without a feed identifier", () => {
    expect(parseMobilityDatabaseCsv("id,data_type\n,gtfs")).toEqual([]);
  });
});
