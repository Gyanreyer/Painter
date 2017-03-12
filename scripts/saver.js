'use strict';

var app = app || {};

app.saver = (function(){
    
    var saver = {};//Module saves the canvas as a jpg
    
    saver.init = function(){
        this.WIDTH = app.watercolor.WIDTH;//Store dimensions of canvas locally
        this.HEIGHT = app.watercolor.HEIGHT;
        
        this.copyCanvas = document.createElement("canvas");//Create our own canvas that we'll use to copy to, we won't actually append this to the page
        this.copyCanvas.width = this.WIDTH;
        this.copyCanvas.height = this.HEIGHT;
        
        this.copyCtx = this.copyCanvas.getContext('2d');
        
        document.querySelector("#save").onclick = this.saveCanvas.bind(this);//Save image whhen the user clicks save button
    };
    
    //Copy webGL canvas to a 2d canvas and save it using Canvas-toBlob and FileSaver libs
    saver.saveCanvas = function(){
        app.watercolor.pause();//Pause the sim
        
        this.copyCtx.fillStyle = "white";//Fill in background of our canvas with white
        this.copyCtx.fillRect(0,0,app.watercolor.WIDTH,app.watercolor.HEIGHT);
        
        app.watercolor.renderDisplay();//Render again so we'll definitely have the image available in frame buffer - this is fastesr than having the renderer preserve its frame buffer and still works
        this.copyCtx.drawImage(app.canvasElement,0,0);//Copy the webGL canvas to our canvas
        
        //Save the image
        var canvasBlob = this.copyCanvas.toBlob(function(blob){
            saveAs(blob, (Math.random()*100000).toFixed(0)+"_Watercolor.jpg");
        });        
    };
    
    return saver;
    
})();

