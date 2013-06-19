String.prototype.startsWith = function (str){
  return this.slice(0, str.length) == str
}

String.prototype.endsWith = function (str){
  return this.slice(-str.length) == str
}


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
      if(tableName.startsWith('_')){ return true }
      var columnsInThisTable = []
      $.each(tableInfo.columnNames, function(i, columnName){
        if(!columnName.startsWith('_')){
          columnsInThisTable.push(columnName)
        }
      })
      var latLngColumns = findLatLngColumns(columnsInThisTable)
      if(latLngColumns.length){
        bestTable = tableName
        bestLatColumn = latLngColumns[0]
        bestLngColumn = latLngColumns[1]
      } else {
        return true
      }
    })
    if(bestTable && bestLatColumn && bestLngColumn){
      scraperwiki.sql('select * from "'+ bestTable +'"', function(data){
        plotDataOnMap(data, bestLatColumn, bestLngColumn)
      }, function(){
        $('#loading, #overlay').fadeOut()
        scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
        return false
      })
    } else {
      $('#loading').hide()
      showPicker(meta)
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


function plotDataOnMap(data, latColumnName, lngColumnName){
  $('#loading').empty().fadeOut()
  $('#overlay, #picker').fadeOut()
  var bounds = []
  $.each(data, function(i, point){
    var lat = point[latColumnName]
    var lng = point[lngColumnName]
    if(typeof(lat) == 'number' && typeof(lng) == 'number'){
      var latLng = [ lat, lng ]
      var popupContent = '<table class="table table-striped">'
      $.each(point, function(key, value){
        if(typeof(value) == 'string'){
          if(value.startsWith('http')){
            value = '<a target="_blank" href="' + value + '">' + value.replace(new RegExp('(https?://.{40}).+'), '$1&hellip;') + '</a>'
          } else if(value.length > 200){
            value = value.slice(0, 199) + '&hellip;'
          }
        }
        popupContent += '<tr><th>' + key + '</th><td>' + value + '</td></tr>'
      })
      popupContent += '</table>'
      L.marker(latLng).bindPopup(popupContent, {maxWidth: 450}).addTo(map)
      bounds.push(latLng)
    }
  })
  if(bounds.length){
    map.fitBounds(bounds)
  } else {
    scraperwiki.alert('Data could not be geocoded', 'Are you sure the selected Latitude and Longitude columns are numeric?', 1)
  }
  return true
}


function showPicker(meta){
  var $picker = $('<div id="picker">').insertBefore('#overlay')
  $picker.append('<h1>Hmm. I couldn&rsquo;t find any geo data</h1>')
  $picker.append('<p>Could you give me a hand and point out the right columns?</p>')
  var $select = $('<select>')
  $.each(meta.table, function(tableName, tableInfo){
    if(!tableName.startsWith('_')){
      var $optgroup = $('<optgroup>').attr('label', tableName)
      $.each(tableInfo.columnNames, function(i, columnName){
        if(!columnName.startsWith('_')){
          $('<option>').text(columnName).val(columnName).appendTo($optgroup)
        }
      })
      $optgroup.appendTo($select)
    }
  })
  $('<p>').append('<label for="latPicker">Latitude:</label>').append($select.clone().attr('id', 'latPicker')).appendTo($picker)
  $('<p>').append('<label for="lngPicker">Longitude:</label>').append($select.clone().attr('id', 'lngPicker')).appendTo($picker)
  $('<p>').append(
    $('<button>').text('Make it so!').addClass('btn btn-primary').on('click', function(){
      var latColumn = $('#latPicker option:selected').val()
      var latTable = $('#latPicker option:selected').parent().attr('label')
      var lngColumn = $('#lngPicker option:selected').val()
      var lngTable = $('#lngPicker option:selected').parent().attr('label')
      if(latTable != lngTable){
        $('#picker p').eq(0).addClass('text-error').html('Oops. Those two columns aren&rsquo;t in the same table. Try again.')
      } else if(latColumn == lngColumn) {
        $('#picker p').eq(0).addClass('text-error').html('Oops. You picked the same column twice. Try again.')
      } else {
        $(this).addClass('loading').text('Plotting map\u2026')
        scraperwiki.sql('select * from "'+ latTable +'"', function(data){
          plotDataOnMap(data, latColumn, lngColumn)
        }, function(){
          $('#picker, #overlay').fadeOut()
          scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
          return false
        })
      }
    })
  ).appendTo($picker)
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
