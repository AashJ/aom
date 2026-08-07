import { TYPE_EGYPTIAN_MONUMENT_TO_PHARAOHS } from "@aom/sim";
import iconUrl from "../../../assets/building-monument-four-icon.png";
import modelUrl from "../../../assets/models/egyptian-monument-to-pharaohs.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_MONUMENT_TO_PHARAOHS, key: "egyptian-monument-to-pharaohs", modelUrl, iconUrl, worldHeight: 5.5 });
