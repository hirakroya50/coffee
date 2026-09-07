import type { ModelListItem } from "@cursor/sdk";
import { pickModelFromList } from "../../tools/agent_driver/model_selection";

describe("pickModelFromList", () => {
  const listed: ModelListItem[] = [
    {
      id: "composer-2.5",
      displayName: "Composer 2.5",
      variants: [
        {
          displayName: "Default",
          isDefault: true,
          params: [{ id: "mode", value: "agent" }],
        },
      ],
    },
    {
      id: "cursor-grok-4.6-medium",
      displayName: "Grok",
    },
  ];

  test("uses default variant params for preferred model", () => {
    expect(pickModelFromList(listed)).toEqual({
      id: "composer-2.5",
      params: [{ id: "mode", value: "agent" }],
    });
  });

  test("honors CURSOR_MODEL env override", () => {
    expect(pickModelFromList(listed, "cursor-grok-4.6-medium")).toEqual({
      id: "cursor-grok-4.6-medium",
    });
  });
});
