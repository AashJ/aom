import { TYPE_EGYPTIAN_MONUMENT_TO_PRIESTS } from "@aom/sim";
import iconUrl from "../../../assets/building-monument-three-icon.png";
import modelUrl from "../../../assets/models/egyptian-monument-to-priests.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_MONUMENT_TO_PRIESTS, key: "egyptian-monument-to-priests", modelUrl, iconUrl, worldHeight: 4 });
