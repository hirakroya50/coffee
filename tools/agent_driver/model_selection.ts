import type { ModelListItem, ModelSelection } from "@cursor/sdk";

const KNOWN_MODEL_DEFAULTS: Record<string, ModelSelection> = {
  "composer-2.5": {
    id: "composer-2.5",
    params: [{ id: "fast", value: "false" }],
  },
  "grok-4.6": {
    id: "grok-4.6",
    params: [
      { id: "effort", value: "medium" },
      { id: "fast", value: "false" },
    ],
  },
};

export function knownModelDefault(id: string): ModelSelection {
  return KNOWN_MODEL_DEFAULTS[id] ?? { id };
}

export function selectionFromListedModel(item: ModelListItem): ModelSelection {
  const defaultVariant =
    item.variants?.find((v) => v.isDefault) ?? item.variants?.[0];
  return {
    id: item.id,
    params: defaultVariant?.params,
  };
}

export function pickModelFromList(
  listed: ModelListItem[],
  envModel?: string
): ModelSelection {
  if (envModel) {
    const match = listed.find(
      (m) => m.id === envModel || m.aliases?.includes(envModel)
    );
    if (match) {
      return selectionFromListedModel(match);
    }
    return knownModelDefault(envModel);
  }

  const preferredIds = [
    "composer-2.5",
    "cursor-grok-4.6-medium",
    "composer-2.5-fast",
  ];
  for (const id of preferredIds) {
    const match = listed.find((m) => m.id === id || m.aliases?.includes(id));
    if (match) {
      return selectionFromListedModel(match);
    }
  }

  if (listed[0]) {
    return selectionFromListedModel(listed[0]);
  }

  return knownModelDefault("composer-2.5");
}
