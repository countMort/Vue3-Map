import { Feature } from "openlayers"
import { toRaw } from "vue"
import {
  CreateMarkers,
  MarkersMixinProps,
  VectorLayerRef,
} from "../components/Map.model"
import { createClusterSource, createMarkers } from "../utils"
import {
  GetClusterByTitle,
  GetMarkerByTitle,
  GetSearchResultByFeature,
} from "./markers.mixin.model"

export function markersMixin({
  map,
  searchMarkers,
  searchResults,
}: MarkersMixinProps) {
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
    map.value?.addLayer(layer)
    return { layer, style }
  }

  /**
   * Removes markers from map
   */
  const clearMarkerLayer = (layer: VectorLayerRef) => {
    if (!layer.value) return
    map.value?.removeLayer(layer.value)
    layer.value = undefined
  }

  /**
   * Toggles cluster source to deactivate or apply clustering (The layer will remain a cluster layer)
   * @param layer
   * @param deactivate - whether to deactivate clustering or apply it.
   */
  const toggleClusterSource = (layer: VectorLayerRef, deactivate: boolean) => {
    if (!layer.value) return
    const rawLayer = toRaw(layer.value)
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
    layer.value.setSource(newSource)
  }

  /**
   * Takes the title of a marker and returns the found cluster and its surrounding cluster
   * @param title - title of wanted feature
   * @returns The found feature and its cluster
   */
  const getClusterByTitle: GetClusterByTitle = (title: string) => {
    const clusters = searchMarkers.value?.getSource().getFeatures()
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
    const markers = searchMarkers.value?.getSource().getFeatures()
    return markers?.find((feature) => feature.get("text") === title)
  }

  /**
   * Takes a feature and returns its relating search item
   * @param feature
   * @returns Search Item
   */
  const getSearchResultByFeature: GetSearchResultByFeature = (feature) => {
    const title = feature.get("text")
    return searchResults.value.find(
      (si) => si.title === (Array.isArray(title) ? title[0] : title)
    )
  }

  return {
    addMarkers,
    clearMarkerLayer,
    toggleClusterSource,
    getClusterByTitle,
    getMarkerByTitle,
    getMarkerInClusterByTitle,
    getSearchResultByFeature,
  }
}
