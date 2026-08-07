import { TYPE_EGYPTIAN_LIGHTHOUSE } from "@aom/sim";
import iconUrl from "../../../assets/building-lighthouse-icon.png";
import modelUrl from "../../../assets/models/egyptian-lighthouse.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_LIGHTHOUSE, key: "egyptian-lighthouse", modelUrl, iconUrl, worldHeight: 9 });
