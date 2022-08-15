import { CreateMarkers, VectorLayer } from "../../components/Map.model"
import {
  GetClusterByTitle,
  GetMarkerByTitle,
  GetSearchResultByFeature,
  SearchOptions,
  SearchProps,
  SelectFeautureOptions,
  ZoomToExtentOptions,
} from "./markers.model"
import {
  createClusterSource,
  createMapPoints,
  createMarkers,
  getClusterExtent,
  getCoordsFromFeature,
  getFeatureExtent,
  getTitleFromData,
  transformCoords,
} from "@/utils"
import { Coordinate, Extent, Feature, MapBrowserEvent } from "openlayers"
import { toRaw } from "vue"
import { state } from "../state"
import { store } from ".."
import { ReverseOnPointOptions } from "../../mixins/events.mixin.model"

/**
 * Receives an array of points and marks them on map.
 * @param points - Array of points.
 * @param point.coords - Coordinates of that point.
 * @param point.text - If you have a particular text for the point.
 * @param point.style - If you have a particular style for that point (only checks the first point for now).
 * @param point.color - If you have a particular color for that point (only checks the first point for now).
 * @param point.image - If you have a particular image for that point (only checks the first point for now).
 * @param point.iconScale - If you have a particular icon scale for that point (only checks the first point for now).
 * @param point.originalItem - original item from neshan search result
 * @param point.props - props to set for point feature
 * @param options.cluster - If these markers need to be clusterd on given zoom number
 * @param options.clusterThreshold - Zoom number that markers should be clusterd on zoom condition above that given zoom
 * @param options.showPopup - If you want show the text as popup
 * @param options.props - Props to set for all features
 * @returns style and layer.
 */
const addMarkers: CreateMarkers = (points, options) => {
  const { layer, style } = createMarkers(points, options)
  state.map?.addLayer(layer)
  return { layer, style }
}
/**
 * Removes markers from map
 */
const clearMarkerLayer = (layer: VectorLayer) => {
  if (!layer) return
  state.map?.removeLayer(layer)
}

/**
 * Toggles cluster source to deactivate or apply clustering (The layer will remain a cluster layer)
 * @param layer
 * @param deactivate - whether to deactivate clustering or apply it.
 */
const toggleClusterSource = (layer: VectorLayer, deactivate: boolean) => {
  if (!layer) return
  const rawLayer = toRaw(layer)
  const clusterFeatures = rawLayer.getSource().getFeatures() || []
  if (!clusterFeatures.some((cf) => cf.get("isCluster"))) return
  const features = clusterFeatures.reduce((result: Feature[], cf) => {
    const features: Feature[] = cf.get("features")
    return [...result, ...features]
  }, [])
  const newDistance = deactivate ? 0 : 30
  const newSource = createClusterSource(features, {
    distance: newDistance,
    minDistance: newDistance,
  })
  layer.setSource(newSource)
}

/**
 * Takes the title of a marker and returns the found cluster and its surrounding cluster
 * @param title - title of wanted feature
 * @returns The found feature and its cluster
 */
const getClusterByTitle: GetClusterByTitle = (title: string) => {
  const clusters = state.searchMarkers.getSource().getFeatures()
  let foundFeature: Feature | undefined
  const cluster = clusters?.find((cluster) => {
    const feature = getMarkerInClusterByTitle(cluster, title)
    if (feature) {
      foundFeature = feature
    }
    return feature
  })
  return {
    feature: foundFeature,
    cluster,
  }
}

/**
 * Take a cluster and a title and returns the feature inside the cluster by its title
 * @param cluster - The cluster we are looking for feature in it
 * @param title - Title of wanted feature
 * @returns The found feature
 */
const getMarkerInClusterByTitle = (cluster: Feature, title: string) => {
  const features: Feature[] | undefined = cluster.get("features")
  return features?.find((feat) => feat.get("text") === title)
}

/**
 * Takes the title of a marker and returns it.
 * @param title - title of wanted feature
 * @returns The found marker
 */
const getMarkerByTitle: GetMarkerByTitle = (title: string) => {
  const markers = state.searchMarkers?.getSource().getFeatures()
  return markers?.find((feature) => feature.get("text") === title)
}

/**
 * Takes a feature and returns its relating search item
 * @param feature
 * @returns Search Item
 */
const getSearchResultByFeature: GetSearchResultByFeature = (feature) => {
  const title = feature.get("text")
  return state.searchResults.find(
    (si) => si.title === (Array.isArray(title) ? title[0] : title)
  )
}

/**
 * Take the layer and zooms on its features
 * @param layer
 * @param options.duration - Zooming duration
 */
const zoomToLayer = (layer: VectorLayer, options?: ZoomToExtentOptions) => {
  const extent: Extent = layer.getSource().getExtent()
  zoomToExtent(extent, options)
}

/**
 * Gets the desired extent and zooms on it
 * @param extent - Extent of the area to zoom on
 * @param options.duration - Zooming duration
 */
const zoomToExtent = (extent: Extent, options?: ZoomToExtentOptions) => {
  const duration = options?.duration || 500
  state.map?.getView().fit(extent, {
    size: state.map.getSize(),
    duration,
    minResolution: 0.3,
    padding: [15, store.getters.screen.small ? 15 : 300, 15, 15],
  })
}

/**
 * Takes the marker and zooms on it
 * @param marker
 * @param options.duration - Zooming duration
 */
const zoomToMarker = (marker: Feature, options?: ZoomToExtentOptions) => {
  const extent = getFeatureExtent(marker)
  zoomToExtent(extent, options)
}

/**
 * Takes the cluster and zooms on it
 * @param cluster
 * @param options.duration - Zooming duration
 */
const zoomToCluster = (cluster: Feature, options?: ZoomToExtentOptions) => {
  const extent = getClusterExtent(cluster)
  zoomToExtent(extent, options)
}

/**
 * Zooms on given feature and shows its details on detail section
 * Adds a persistant overlay on it
 * @param feature
 * @param options
 */
const selectFeauture = (feature: Feature, options?: SelectFeautureOptions) => {
  zoomToMarker(feature)
  const coords = options?.coords || getCoordsFromFeature(feature)
  const isMainMarker: boolean = feature?.getProperties().mainMarker
  let text = options?.text || feature.getProperties().text
  if (Array.isArray(text)) text = text[0]
  if (options?.delay !== 0) {
    setTimeout(() => {
      store.actions.overlays.changeOverlayStats(
        { coords, text, offset: isMainMarker ? [0, -60] : [0, -40] },
        "persistant"
      )
    }, options?.delay || 500)
  } else {
    store.actions.overlays.changeOverlayStats(
      { coords, text, offset: isMainMarker ? [0, -60] : [0, -40] },
      "persistant"
    )
  }
  const foundResult = isMainMarker
    ? state.reverseResult
    : store.actions.markers.getSearchResultByFeature(feature)
  if (foundResult) {
    store.setSelectedMarker(foundResult)
    store.actions.drawers.openResultDrawers()
  }
}

/**
 * Looks for features in current hover or click event of map
 * @param evt - Map hover or click event
 * @returns feature (If found)
 */
const getFeatureFromEvent = (evt: MapBrowserEvent) => {
  return <Feature | undefined>(
    store.state.map?.forEachFeatureAtPixel(evt.pixel, (feature) => feature)
  )
}
/**
 * Places a marker on a point on ol map
 * Sends a reverse request on that position
 * and adds a title based on returned value
 * @param point - OL Coords
 * @param putMarker - Whether to put marker on locating area
 * @returns marker, standard coords of point and api result data
 */
const reverseOnPoint = async (
  point: Coordinate,
  { useMarker = true, usePopup = true, customText }: ReverseOnPointOptions = {}
) => {
  try {
    const stdPoint = transformCoords(point)
    let marker: VectorLayer | null = null
    if (useMarker) {
      const { layer } = store.actions.markers.addMarkers(
        [{ coords: point, text: "" }],
        {
          props: {
            mainMarker: true,
            isCluster: false,
          },
          anchor: [0.5, 1],
        }
      )
      store.setMainMarkerCoords(stdPoint)
      store.setMainMarker(layer)
      marker = layer
    }
    if (!store.state.api) throw "No reverse api"
    const data = await store.state.api.REVERSE(...stdPoint)
    store.setSelectedMarker(data)
    store.setReverseResult(data)
    store.actions.drawers.openResultDrawers()
    const text = customText || getTitleFromData(data)
    store.state.mainMarker?.getSource().getFeatures()[0].set("text", text)
    if (usePopup) {
      store.actions.overlays.changeOverlayStats(
        { coords: point, text, offset: [0, -60] },
        "persistant"
      )
    }
    return { marker, stdPoint, data }
  } catch (error) {
    console.log(error)
    return {}
  }
}

/**
 * Does a neshan search based on given parameters
 * @param searchParams.text - Part of or whole name of the place.
 * @param searchParams.coords - Coordinates you want to search around.
 */
const search = async (
  { term = "", coords }: SearchProps,
  options?: SearchOptions
) => {
  try {
    store.toggleSearchLoading(true)
    if (!store.state.api) return
    const result = await store.state.api.SEARCH(term, coords)
    store.toggleDrawerShowDetails(false)
    clearMarkerLayer(store.state.searchMarkers)
    store.setSearchResults(result.items)
    const points = createMapPoints(result.items)
    const { layer } = store.actions.markers.addMarkers(points, {
      markersIconCallback: options?.markersIconCallback,
      cluster: options?.cluster,
      clusterThreshold: options?.clusterThreshold,
    })
    store.actions.overlays.changeOverlayStats(undefined, "persistant")
    store.state.searchMarkers = layer
    // Apparently it takse some async time to cluster the source
    setTimeout(() => {
      const features = layer.getSource().getFeatures()
      //To fix a problem with zooming on single feature layers extent
      if (features.length === 1) {
        store.actions.markers.zoomToCluster(features[0], { duration: 1500 })
      } else {
        store.actions.markers.zoomToLayer(layer, { duration: 1500 })
      }
    }, 200)
  } catch (error) {
    console.log(error)
  } finally {
    store.toggleSearchLoading(false)
  }
}

export const markersActions = {
  addMarkers,
  clearMarkerLayer,
  toggleClusterSource,
  getClusterByTitle,
  getMarkerInClusterByTitle,
  getMarkerByTitle,
  getSearchResultByFeature,
  zoomToLayer,
  zoomToExtent,
  zoomToMarker,
  zoomToCluster,
  selectFeauture,
  getFeatureFromEvent,
  reverseOnPoint,
  search,
}
