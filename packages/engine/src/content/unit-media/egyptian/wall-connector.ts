import { TYPE_EGYPTIAN_WALL_CONNECTOR } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/egyptian-wall-connector.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_WALL_CONNECTOR, key: "egyptian-wall-connector", modelUrl, iconUrl, worldHeight: 2.2 });
