import { Tile } from "../components/Map.model";

export const urls = {
    reverse: "https://api.neshan.org/v4/reverse",
    search: "https://api.neshan.org/v1/search",
    map: "https://static.neshan.org/sdk/openlayers/5.3.0/ol.js",
};

export const tiles: Tile[] = [
    {
        title: "osm-bright",
        url: "https://static.neshan.org/sdk/examples/maptypes/images/map-types-bright.png",
    },
    {
        title: "standard-night",
        url: "https://static.neshan.org/sdk/examples/maptypes/images/map-types-standard-night.png",
    },
    {
        title: "standard-day",
        url: "https://static.neshan.org/sdk/examples/maptypes/images/map-types-standard-day.png",
    },
    {
        title: "neshan",
        url: "https://static.neshan.org/sdk/examples/maptypes/images/map-types-neshan.png",
    },
    {
        title: "dreamy-gold",
        url: "https://static.neshan.org/sdk/examples/maptypes/images/map-types-dreamy-gold.png",
    },
    {
        title: "dreamy",
        url: "https://static.neshan.org/sdk/examples/maptypes/images/map-types-dreamy.png",
    },
];