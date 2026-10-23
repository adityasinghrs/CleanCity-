const { computePriority } = require("../utils/priority");
const { detectImageType } = require("../utils/image");
const { validateRegister, validateComplaint, checkPassword } = require("../utils/validate");

describe("priority score", () => {
  const now = Date.now();
  test("hazardous waste is more urgent than 'other'", () => {
    const a = computePriority({ status: "Pending", category: "Hazardous Waste", upvoteCount: 0, createdAt: now }, now);
    const b = computePriority({ status: "Pending", category: "Other", upvoteCount: 0, createdAt: now }, now);
    expect(a.priority).toBeGreaterThan(b.priority);
  });
  test("upvotes and age raise the score and level", () => {
    const fresh = computePriority({ status: "Pending", category: "Missed Pickup", upvoteCount: 0, createdAt: now }, now);
    const old = computePriority({ status: "Pending", category: "Missed Pickup", upvoteCount: 4, createdAt: now - 10 * 864e5 }, now);
    expect(fresh.level).toBe("Low");
    expect(old.priority).toBe(20 + 4 * 5 + 10 * 2);
    expect(old.level).toBe("High");
  });
  test("age is capped at 30 days", () => {
    const r = computePriority({ status: "Pending", category: "Other", upvoteCount: 0, createdAt: now - 365 * 864e5 }, now);
    expect(r.priority).toBe(10 + 60);
  });
  test("resolved complaints score 0 / Done", () => {
    expect(computePriority({ status: "Resolved", category: "Hazardous Waste", upvoteCount: 9, createdAt: now }, now))
      .toEqual({ priority: 0, level: "Done" });
  });
});

describe("image type detection", () => {
  const pad = (b) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
  test("accepts jpeg, png, webp", () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(4)]))).toBe("image/webp");
  });
  test("rejects a script renamed to .jpg", () => {
    expect(detectImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});

describe("validation", () => {
  test("password rules", () => {
    expect(checkPassword("short1")).toMatch(/8-72/);
    expect(checkPassword("allletters")).toMatch(/letter and a number/);
    expect(checkPassword("Good1234")).toBeNull();
  });
  test("register normalises email and rejects bad input", () => {
    expect(validateRegister({ name: "Asha", email: " ASHA@Mail.com ", password: "Good1234" }).data.email).toBe("asha@mail.com");
    expect(validateRegister({ name: "A", email: "x@y.z", password: "Good1234" }).error).toBeTruthy();
    expect(validateRegister({ name: "Asha", email: "nope", password: "Good1234" }).error).toBeTruthy();
    expect(validateRegister({ name: "Asha", email: "a@b.co", password: { $ne: 1 } }).error).toBeTruthy();
  });
  test("complaint validation", () => {
    expect(validateComplaint({ title: "", location: "x" }).error).toBeTruthy();
    expect(validateComplaint({ title: "t", location: "x", category: "Bogus" }).error).toBe("Invalid category");
    expect(validateComplaint({ title: "t", location: "x", lat: "999", lng: "10" }).error).toBe("Invalid GPS coordinates");
    const ok = validateComplaint({ title: "t", location: "x", lat: "28.6", lng: "77.2" });
    expect(ok.data.coords.coordinates).toEqual([77.2, 28.6]);
    expect(ok.data.category).toBe("Other");
  });
});
