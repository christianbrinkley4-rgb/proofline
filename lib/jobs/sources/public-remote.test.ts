import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJson } from "./http";
import { normalizeHimalayas, normalizeJobicy, searchHimalayas, searchJobicy } from "./public-remote";

vi.mock("./http", () => ({ getJson: vi.fn() }));
const mockedGetJson = vi.mocked(getJson);

beforeEach(() => mockedGetJson.mockReset());

describe("public remote source normalization", () => {
  it("preserves US eligibility, a real posting date, and USD pay", () => {
    const job = normalizeHimalayas({
      guid: "h-1",
      title: "Customer Support Intern",
      companyName: "Example",
      applicationLink: "https://himalayas.app/jobs/customer-support-intern",
      description: "<p>Help customers</p>",
      employmentType: "Intern",
      locationRestrictions: [{ alpha2: "US", name: "United States" }],
      currency: "USD",
      minSalary: 22,
      maxSalary: 27,
      salaryPeriod: "hourly",
      pubDate: 1_780_000_000_000,
    });
    expect(job).toMatchObject({
      source: "himalayas",
      sourceId: "h-1",
      location: "Remote · United States",
      mode: "remote",
      level: "internship",
      description: "Help customers",
      payMin: 22,
      payMax: 27,
      payPeriod: "hour",
    });
    expect(job?.postedAt?.getTime()).toBe(1_780_000_000_000);
  });

  it("does not mislabel non-USD or monthly salary as dollars per year", () => {
    const job = normalizeJobicy({
      id: 7,
      url: "https://jobicy.com/jobs/a-role",
      jobTitle: "Support specialist",
      companyName: "Example",
      jobGeo: "Anywhere",
      salaryMin: 4500,
      salaryMax: 6000,
      salaryCurrency: "EUR",
      salaryPeriod: "monthly",
      pubDate: "2026-09-01T00:00:00Z",
    });
    expect(job).toMatchObject({ source: "jobicy", location: "Remote · Anywhere", payMin: null, payMax: null, payPeriod: null });
    expect(job?.postedAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("drops expired or off-provider links, so attribution remains possible", () => {
    const base = { guid: "h-1", title: "Role", companyName: "Example", applicationLink: "https://himalayas.app/jobs/a" };
    expect(normalizeHimalayas({ ...base, expiryDate: "2020-01-01" })).toBeNull();
    expect(normalizeHimalayas({ ...base, applicationLink: "https://another-site.example/apply" })).toBeNull();
    expect(normalizeJobicy({ id: 1, url: "https://another-site.example/job", jobTitle: "Role", companyName: "Example" })).toBeNull();
  });
});

describe("public remote requests", () => {
  it("caps Himalayas pagination at two pages and passes the country eligibility filter", async () => {
    mockedGetJson.mockResolvedValue({ jobs: [{ guid: "1", title: "Analyst", companyName: "Example", applicationLink: "https://himalayas.app/jobs/analyst" }] });
    const jobs = await searchHimalayas("financial analyst test", { country: "US", pages: 99 });
    expect(mockedGetJson).toHaveBeenCalledTimes(2);
    expect(mockedGetJson.mock.calls[0][0]).toContain("country=US");
    expect(mockedGetJson.mock.calls[1][0]).toContain("page=2");
    expect(jobs).toHaveLength(1);
  });

  it("makes one bounded Jobicy request with the public listing URL", async () => {
    mockedGetJson.mockResolvedValue({ jobs: [{ id: 1, url: "https://jobicy.com/jobs/support", jobTitle: "Support", companyName: "Example" }] });
    const jobs = await searchJobicy("support test", { geo: "usa", count: 500 });
    expect(mockedGetJson).toHaveBeenCalledTimes(1);
    expect(mockedGetJson.mock.calls[0][0]).toContain("count=100");
    expect(mockedGetJson.mock.calls[0][0]).toContain("geo=usa");
    expect(jobs[0].url).toBe("https://jobicy.com/jobs/support");
  });
});
