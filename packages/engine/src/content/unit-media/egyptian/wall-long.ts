import { TYPE_EGYPTIAN_WALL_LONG } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/egyptian-wall-long.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_WALL_LONG, key: "egyptian-wall-long", modelUrl, iconUrl, worldHeight: 2.2 });
