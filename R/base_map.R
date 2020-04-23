library(rgdal)
library(dplyr)
library(leaflet)
library(leaflet.extras)

setwd("/home/zhoylman/")

states = rgdal::readOGR("/home/zhoylman/mesonet-dashboard/data/shp/states.shp")

#define basemap function
base_map = function(x){
  leaflet::leaflet(options = leafletOptions(zoomControl = FALSE)) %>%
    leaflet::addTiles("https://api.maptiler.com/tiles/hillshades/{z}/{x}/{y}.png?key=KZO7rAv96Alr8UVUrd4a") %>%
    leaflet::addProviderTiles("Stamen.TonerLines") %>%
    leaflet::addProviderTiles("Stamen.TonerLabels") %>%
    leaflet::setView(lng = -109.5, lat = 47, zoom = 5) %>%
    leaflet::addPolygons(data = states, group = "States", fillColor = "transparent", weight = 2, color = "black", opacity = 1)
}
