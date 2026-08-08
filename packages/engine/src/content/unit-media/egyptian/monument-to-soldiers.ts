import { TYPE_EGYPTIAN_MONUMENT_TO_SOLDIERS } from "@aom/sim";
import iconUrl from "../../../assets/building-monument-two-icon.png";
import modelUrl from "../../../assets/models/egyptian-monument-to-soldiers.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_MONUMENT_TO_SOLDIERS, key: "egyptian-monument-to-soldiers", modelUrl, iconUrl, worldHeight: 3.5 });
