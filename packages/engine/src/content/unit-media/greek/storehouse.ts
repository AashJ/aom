import { TYPE_GREEK_STOREHOUSE } from "@aom/sim";
import iconUrl from "../../../assets/building-storehouse-icon.png";
import modelUrl from "../../../assets/models/greek-storehouse.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_STOREHOUSE, key: "greek-storehouse", modelUrl, iconUrl, worldHeight: 3 });
