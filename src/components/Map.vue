<template>
  <!-- <img :src="require('@/assets/search-marker.png')" /> -->
  <div
    ref="mapContainer"
    class="map pos-relative o-hidden"
    :class="{
      touch: store.getters.touchPlatform
    }"
    :style="`font-size: ${fontSize}`"
  >
    <div
      ref="popupContainer"
      class="map-popup-container"
      :class="temporaryPopupContainerClass"
      :style="temporaryPopupContainerStyle"
    ></div>
    <div
      ref="persistentContainer"
      class="map-popup-container"
      :class="persistentPopupContainerClass"
      :style="persistentPopupContainerStyle"
    ></div>
    <slot
      v-if="!hideLayers"
      name="layers"
      :tiles="filteredTiles"
      :mapType="store.state.mapType"
      :poi="store.state.poiLayer"
      :traffic="store.state.trafficLayer"
    >
      <DesktopLayers
        v-if="!store.getters.touchPlatform"
        :tiles="filteredTiles"
        :layersClass="desktopLayersClass"
        :layersStyle="desktopLayersStyle"
      />
      <MobileLayers
        v-else
        v-model="mobileDrawerModel"
        :tiles="filteredTiles"
        :layersClass="mobileLayersClass"
        :layersStyle="mobileLayersStyle"
      ></MobileLayers>
      <button
        v-if="store.getters.touchPlatform"
        class="mobile-layers-button pos-absolute justify-center align-center d-flex pointer"
        @click="handleMobileDrawerClick"
      >
        <img src="../assets/images/layers-outline.svg" />
      </button>
    </slot>
    <slot v-if="!hideSearchContainer" name="search-container">
      <Drawer
        :items="store.state.searchResults"
        @search="handleSearch"
        @result-click="handleResultClick"
        @result-hover="handleResultHover"
      />
      <MobileDetailsSection
        v-if="store.getters.touchPlatform"
        v-show="store.state.mobileDrawerShowDetails"
      ></MobileDetailsSection>
    </slot>
  </div>
</template>
<script lang="ts">
declare const ol: any;
import { zoomConstants, tiles, urls } from "../parameters";
import { sanitizeLocation, getLocation } from "../utils";
import { eventsMixin } from "../mixins";
import { createApi } from "../apis";
import { storeGen } from "../store";
import {
  defineProps,
  onMounted,
  PropType,
  ref,
  watch,
  defineExpose,
  defineEmits,
  reactive,
  provide
} from "vue";
import {
  CoordsObj,
  MarkersIconCallback,
  MarkerHoverCallback,
  HandleSearchProps
} from "./Map.model";
import { SearchOptions } from "../store/markers/markers.model";
import { MapType, OlMap, ViewType } from "../store/map/map.model";
import { CreateApiOptions } from "@/apis/apis.model";
export default {
  name: "NeshanMap"
};
</script>
<script setup lang="ts">
import DesktopLayers from "./layers/DesktopLayers.vue";
import MobileLayers from "./layers/MobileLayers.vue";
import Drawer from "./drawer/DrawerComp.vue";
import MobileDetailsSection from "./MobileDetailsSection.vue";

const props = defineProps({
  /**
   * کلید نقشه، گرفته شده از پلتفرم نشان
   */
  mapKey: {
    type: String,
    required: true
  },
  /**
   * کلید سرویس‌ها برای تبدیل نقطه به آدرس (Reverse) و جستجو (search)
   */
  serviceKey: {
    type: String,
    default: ""
  },
  reverseUrl: String,
  searchUrl: String,
  /**
   * مرکز نقشه در هنگام شروع
   */
  center: {
    type: Object as PropType<CoordsObj>,
    default: null
  },
  /**
   * میزان زوم نقشه در هنگام شروع
   */
  zoom: {
    type: Number,
    default: zoomConstants.initialZoom
  },
  /**
   * نمایش یا عدم نمایش نقاط
   */
  poi: {
    type: Boolean,
    default: true
  },
  /**
   * نمایش یا عدم نمایش خطوط ترافیک
   */
  traffic: {
    type: Boolean,
    default: true
  },
  /**
   * نوع نقشه در هنگام شروع
   * <br>
   * neshan
  | dreamy
  | dreamy-gold
  | standard-night
  | standard-day
  | osm-bright 
   */
  defaultType: {
    type: String as PropType<MapType>,
    default: "neshan"
  },
  /**
   * آرایه‌ای از انواع نقشه‌هایی که می‌خواهید در لایه‌ها نمایش داده شود.
   */
  mapTypes: {
    type: Array as PropType<MapType[]>,
    default: tiles.map((tile) => tile.title)
  },
  /**
   * تغییر کلاس بخش لایه‌ها برای حالت دستکتاپ
   */
  desktopLayersClass: [String, Array, Object],
  /**
   * تغییر کلاس بخش لایه‌ها برای حالت موبایل
   */
  mobileLayersClass: [String, Array, Object],
  /**
   * تغییر استایل بخش لایه‌ها برای حالت دستکتاپ
   */
  desktopLayersStyle: Object,
  /**
   * تغییر استایل بخش لایه‌ها برای حالت موبایل
   */
  mobileLayersStyle: Object,
  /**
   * تغییر کلاس پاپ آپ موقت (هنگامی که کاربر با موس هاور می‌کند)
   */
  temporaryPopupContainerClass: [String, Array, Object],
  /**
   * تغییر کلاس پاپ آپ دائم (هنگامی که کاربر کلیک می‌کند)
   */
  persistentPopupContainerClass: [String, Array, Object],
  /**
   * تغییر استایل پاپ آپ موقت (هنگامی که کاربر با موس هاور می‌کند)
   */
  temporaryPopupContainerStyle: Object,
  /**
   * تغییر استایل پاپ آپ دائم (هنگامی که کاربر کلیک می‌کند)
   */
  persistentPopupContainerStyle: Object,
  /**
   * عدم نمایش لایه‌ها
   */
  hideLayers: Boolean,
  /**
   * عدم نمایش بخش سرج و نتایج
   */
  hideSearchContainer: Boolean,
  markersIconCallback: Function as PropType<MarkersIconCallback>,
  markerHoverCallback: Function as PropType<MarkerHoverCallback>,
  popupOnMarkerHover: {
    type: Boolean,
    default: true
  },
  popupOnResultHover: {
    type: Boolean,
    default: true
  },
  zoomOnMarkerClick: {
    type: Boolean,
    default: true
  },
  zoomOnResultClick: {
    type: Boolean,
    default: true
  },
  cluster: {
    type: Boolean,
    default: true
  },
  clusterThreshold: {
    type: Number,
    default: 18
  },
  reverseOnClick: {
    type: Boolean,
    default: true
  },
  scale: {
    type: Number,
    default: 1
  },
  viewType: String as PropType<ViewType>
});

const store = storeGen();
provide("store", store);

/**
 * Sets the given token for api
 * @param token
 */
const setToken = (token: string, options?: CreateApiOptions) => {
  store.state.api = createApi(token, options);
};
setToken(props.serviceKey, {
  searchUrl: props.searchUrl,
  reverseUrl: props.reverseUrl
});
/**
 * Whenever service token changes,
 * applies it to api
 */
watch(
  () => [props.serviceKey, props.searchUrl, props.reverseUrl],
  (nv) => {
    setToken(nv[0] as string, {
      searchUrl: nv[1],
      reverseUrl: nv[2]
    });
  }
);
const fontSize = ref(props.scale + "rem");
// eslint-disable-next-line vue/no-setup-props-destructure
store.state.scale = props.scale;
watch(
  () => props.scale,
  (nv) => {
    fontSize.value = nv + "rem";
    store.state.scale = nv;
    updateNeshanBrandContainerScale();
  }
);

let neshanBrandContainer: HTMLDivElement;
const getNeshanBrandContainer = () => {
  if (neshanBrandContainer) return neshanBrandContainer;
  const allDivs = mapContainer.value
    ?.querySelector(".ol-viewport")
    ?.querySelectorAll("div:last-child");
  if (!allDivs) return;
  neshanBrandContainer = Array.from(allDivs)[
    allDivs.length - 1
  ] as HTMLDivElement;
  return neshanBrandContainer;
};

const updateNeshanBrandContainerScale = () => {
  const neshanMapContainer = getNeshanBrandContainer();
  neshanMapContainer?.style.setProperty("scale", "" + props.scale);
};

const updateNeshanBrandContainerPos = () => {
  const neshanMapContainer = getNeshanBrandContainer();
  neshanMapContainer?.style.setProperty("bottom", "0.2em");
  neshanMapContainer?.style.setProperty("left", "0.4em");
};

// eslint-disable-next-line vue/no-setup-props-destructure
store.state.viewType = props.viewType;
watch(
  () => props.viewType,
  (nv) => {
    store.state.viewType = nv;
  }
);

const mobileDrawerModel = ref(false);
const filteredTiles = reactive(
  tiles.filter((tile) => props.mapTypes.includes(tile.title))
);
store.actions.map.toggleTraffic(props.traffic);
store.actions.map.togglePoi(props.poi);
watch(
  () => props.traffic,
  (nv) => {
    store.actions.map.toggleTraffic(nv);
  }
);
watch(
  () => props.poi,
  (nv) => {
    store.actions.map.togglePoi(nv);
  }
);
const mapContainer = ref<HTMLDivElement>();
/**
 * Adds the map from given url to given script
 * @param url - Url of map or another script
 * @param tagName - Name of the expected tag
 * @returns Created tag
 */
const importMap = (url: string, tagName = "my-openlayer") => {
  const foundDoc = document.getElementById(tagName);
  if (foundDoc) return foundDoc; // was already loaded
  const scriptTag = document.createElement("script");
  scriptTag.src = url;
  scriptTag.id = tagName;
  document.getElementsByTagName("head")[0].appendChild(scriptTag);
  return scriptTag;
};

const sanitizedCenter = ref(
  sanitizeLocation(props.center)
);
/**
 * Starts the map and adds it to element with id='map'
 * Gets the mapKey, zoom, traffic and poi from props.
 * Gets the center from either sanitizedCenter variable or gets it from divice location
 * or Neshan building location.
 */
const startMap = async () => {
  if (!mapContainer.value) return;
  const centralCoords = sanitizedCenter.value || (await getLocation());
  const newMap: OlMap = new ol.Map({
    target: mapContainer.value,
    key: props.mapKey,
    // mapType: 'standard-night',
    poi: store.state.poiLayer,
    traffic: store.state.trafficLayer,
    view: new ol.View({
      center: ol.proj.fromLonLat(centralCoords),
      zoom: props.zoom,
      smoothExtentConstraint: true
      // projection: 'EPSG:4326' //Default was EPSG:3857
    }),
    controls: []
  });
  store.state.map = newMap;
  store.state.map.setMapType(props.defaultType);
  // Currently there is a problem with assigning different map type on initilization
  store.state.mapType = props.defaultType;
  store.actions.map.shakeMap(300);
};

const popupContainer = ref<HTMLDivElement>();
const persistentContainer = ref<HTMLDivElement>();
const eventsEmits = defineEmits([
  "on-zoom",
  "on-click",
  "on-result-hover",
  "on-result-click"
]);
const { setupMapEvents, handleResultHover, handleResultClick } = eventsMixin({
  emits: eventsEmits,
  store,
  markerHoverCallback: props.markerHoverCallback,
  markersIconCallback: props.markersIconCallback,
  zoomOnMarkerClick: props.zoomOnMarkerClick,
  zoomOnResultClick: props.zoomOnResultClick,
  popupOnMarkerHover: props.popupOnMarkerHover,
  popupOnResultHover: props.popupOnResultHover,
  reverseOnClick: props.reverseOnClick
});

/**
 * Changes cluster source to marker source on cluster threshold passing and vice versa
 */
watch(
  () => store.state.zoom,
  (nv, ov) => {
    if(!store.state.searchMarkers) return
    if (nv >= props.clusterThreshold && ov < props.clusterThreshold) {
      store.actions.markers.toggleClusterSource(
        store.state.searchMarkers,
        true
      );
    } else if (nv < props.clusterThreshold && ov >= props.clusterThreshold) {
      store.actions.markers.toggleClusterSource(
        store.state.searchMarkers,
        false
      );
    }
  }
);

const handleSearch = ({ term, coords }: HandleSearchProps) => {
  const reliableCoords =
    coords || store.state.mainMarkerCoords || sanitizedCenter.value;
  if (!reliableCoords || !store.state.api) return;
  const options: SearchOptions = {
    cluster: props.cluster,
    clusterThreshold: props.clusterThreshold,
    markersIconCallback: props.markersIconCallback
  };
  store.actions.markers.search({ term, coords: reliableCoords }, options);
};

const exposingSearch = ({ term, coords }: HandleSearchProps) => {
  store.state.drawerActivation = true;
  handleSearch({ term, coords });
};

const handleMobileDrawerClick = (event: MouseEvent) => {
  const target: any = event.composedPath()[1];
  target.classList.add("floaten");
  setTimeout(() => target.classList.remove("floaten"), 350);
  mobileDrawerModel.value = true;
};

defineExpose({
  state: store.state,
  search: exposingSearch,
  reverse: store.actions.markers.reverseOnPoint
});

const onScriptLoad = async () => {
  await startMap();
  setupMapEvents();
  store.actions.dimensions.updateMapDimensions();
};
store.actions.dimensions.updateBreakpoints();
/**
 * Setups Map, adds serviceToken to api
 */
onMounted(() => {
  if (mapContainer.value) store.state.mapContainer = mapContainer.value;
  if (popupContainer.value) store.state.popupContainer = popupContainer.value;
  if (persistentContainer.value)
    store.state.persistentContainer = persistentContainer.value;
  if (typeof ol !== "undefined") {
    onScriptLoad();
  } else {
    const scriptTag = importMap(urls.map);
    scriptTag.addEventListener("load", () => {
      onScriptLoad();
    });
  }
  updateNeshanBrandContainerScale();
  updateNeshanBrandContainerPos();
});
</script>

<style lang="scss">
@import url("@/assets/main.scss");
@import url("https://static.neshan.org/sdk/openlayers/5.3.0/ol.css");
.ol-overlay-container {
  pointer-events: none;
}
</style>
<style lang="scss" scoped>
@import url("./Map.scss");
</style>
