import assert from "node:assert/strict";
import { brandTdsFixtures } from "../lib/paint-tds/brand-test-library";
import { parsePaintTds } from "../lib/paint-tds/parse-paint-tds";

for (const fixture of brandTdsFixtures) {
  const parsed = await parsePaintTds({
    fileName: fixture.fileName,
    pages: [{ pageNumber: 1, text: fixture.text }],
  });

  assert.equal(
    parsed.product.manufacturer,
    fixture.manufacturer,
    `${fixture.fileName}: manufacturer`,
  );

  if (fixture.expectedRateUnit === null) {
    assert.equal(
      parsed.coverageProfiles.length,
      0,
      `${fixture.fileName}: accessories should not invent a rate`,
    );
  } else {
    assert.ok(
      parsed.coverageProfiles.some(
        (profile) => profile.rateUnit === fixture.expectedRateUnit,
      ),
      `${fixture.fileName}: expected ${fixture.expectedRateUnit}`,
    );
  }
}

console.log(
  `Validated ${brandTdsFixtures.length} South African TDS manufacturer fixtures.`,
);
