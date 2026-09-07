import { Cursor, type ModelListItem, type ModelSelection } from "@cursor/sdk";
import { pickModelFromList } from "./model_selection";

export async function resolveBuilderModel(apiKey: string): Promise<ModelSelection> {
  const envModel = process.env.CURSOR_MODEL?.trim();
  let listed: ModelListItem[] = [];
  try {
    listed = await Cursor.models.list({ apiKey });
  } catch {
    // Fall back to known defaults when the models API is unreachable.
  }

  const selection = pickModelFromList(listed, envModel);
  return selection;
}
