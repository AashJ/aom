import { TYPE_GREEK_WALL_CONNECTOR } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/greek-wall-connector.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_WALL_CONNECTOR, key: "greek-wall-connector", modelUrl, iconUrl, worldHeight: 2.2 });
