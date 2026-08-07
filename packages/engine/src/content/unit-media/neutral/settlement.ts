import { TYPE_SETTLEMENT } from "@aom/sim";
import iconUrl from "../../../assets/building-settlement-icon.png";
import modelUrl from "../../../assets/models/settlement.glb?url";
import { singleModelBuildingMedia } from "../../building-media";

export const definition = singleModelBuildingMedia({ type: TYPE_SETTLEMENT, key: "settlement", modelUrl, iconUrl, worldHeight: 3.5 });
