import { extractJson } from "../../tools/agent_driver/json";

describe("extractJson", () => {
  test("parses raw and fenced objects", () => {
    expect(extractJson('{"approved":true,"reasons":["ok"]}')).toEqual({
      approved: true,
      reasons: ["ok"],
    });
    expect(
      extractJson('Here you go:\n```json\n{"approved":false,"reasons":["no"]}\n```')
    ).toEqual({ approved: false, reasons: ["no"] });
  });

  test("parses the first object when multiple JSON blobs are present", () => {
    const duplicate =
      '{"approved":false,"reasons":["no"]}\n{"approved":false,"reasons":["retry"]}';
    expect(extractJson(duplicate)).toEqual({
      approved: false,
      reasons: ["no"],
    });
  });

  test("throws with a preview when JSON is missing", () => {
    expect(() => extractJson("")).toThrow(/empty/);
    expect(() => extractJson("I approve this change.")).toThrow(
      /did not return JSON/
    );
  });
});
