function detectColumns(){
  scraperwiki.sql.meta(function(meta){
    if(meta.table.length == 0){
      $('#loading, #overlay').fadeOut()
      scraperwiki.alert('This dataset is empty', 'Try running this tool again once you&rsquo;ve got some data.')
      return false
    }

    $('#loading').html('<img src="img/loader-666-fff.gif" width="16" height="16"> Detecting geo data')
    var bestTable = null
    var bestLatColumn = null
    var bestLngColumn = null
    
    $.each(meta.table, function(tableName, tableInfo){
      if(tableName.indexOf('_') == 0){ return true }
      var columnsInThisTable = []
      $.each(tableInfo.columnNames, function(i, columnName){
        if(columnName.indexOf('_') != 0){
          columnsInThisTable.push(columnName)
        }
      })
      var latLngColumns = findLatLngColumns(columnsInThisTable)
      if(latLngColumns.length){
        bestTable = tableName
        bestLatColumn = latLngColumns[0]
        bestLngColumn = latLngColumns[1]
      } else {
        return false
      }
    })
    if(bestTable && bestLatColumn && bestLngColumn){
      scraperwiki.sql('select "'+ bestLatColumn +'" as lat, "'+ bestLngColumn +'" as lng from "'+ bestTable +'"', function(data){
        $('#loading').empty().fadeOut()
        $('#overlay').fadeOut()
        var bounds = []
        $.each(data, function(i, point){
          if(point.lat != null && point.lng != null){
            var latLng = [point.lat, point.lng]
            L.marker(latLng).addTo(map)
            bounds.push(latLng)
          }
        })
        map.fitBounds(bounds)
        return true
      }, function(){
        $('#loading, #overlay').fadeOut()
        scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
        return false
      })
    } else {
      $('#loading, #overlay').fadeOut()
      scraperwiki.alert('Could not find geo information', 'Are you sure your dataset contains latitude and longitude information?')
    }
  }, function(){
    $('#loading, #overlay').fadeOut()
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}


function findLatLngColumns(list){
  if($.inArray('lat', list) > -1 && $.inArray('lng', list) > -1){
    return ['lat', 'lng']
  } else if($.inArray('lat', list) > -1 && $.inArray('long', list) > -1){
    return ['lat', 'long']
  } else if($.inArray('lat', list) > -1 && $.inArray('lon', list) > -1){
    return ['lat', 'lon']
  } else if($.inArray('latitude', list) > -1 && $.inArray('longitude', list) > -1){
    return ['latitude', 'longitude']
  } else {
    return []
  }
}


// Don't bother waiting for DOM to load.
// It'll be ready by the time the API has responded.
var map = null
detectColumns()


$(function(){

  // DOM is ready. Create map.
  map = L.map('map').setView([53.4167, -3], 8)
  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

});
