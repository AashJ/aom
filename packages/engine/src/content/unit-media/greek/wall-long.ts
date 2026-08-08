import { TYPE_GREEK_WALL_LONG } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/greek-wall-long.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_WALL_LONG, key: "greek-wall-long", modelUrl, iconUrl, worldHeight: 2.2 });
