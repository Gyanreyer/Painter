'use strict';

var app = app || {};

app.ui = (function(){
    
    var ui = {};
    
    //Set up stuff so that ui will fade out when mouse isn't moving and then fade back in when it is moving
    ui.init = function(){
        if('ontouchstart' in window || navigator.msMaxTouchPoints) return;//If on mobile/touch screen device, always keep ui visible so ignore literally all of this
        
        this.containerElement = document.querySelector("#ui");//Get div that holds all ui elements, we'll just fade this in/out
        
        //When user moves their mouse on canvas, fade in ui
        app.canvasElement.onmousemove = function(){
            if(this.fadeoutID){//If a timeout event has been set to fade out the ui, cancel it
                clearTimeout(this.fadeoutID); 
            }
            
            //Fade in ui and make mouse visible
            this.containerElement.style.opacity = "1";
            app.canvasElement.style.cursor = "auto";
            
            //If mouse stays inactive for 3 seconds, fade ui back out and hide mouse
            this.fadeoutID = setTimeout(function(){
                this.containerElement.style.opacity = "0";
                app.canvasElement.style.cursor = "none";
                
                this.fadeoutID = null;//Reset fadeoutID to null
            }.bind(this),3000);    
            
        }.bind(this);
        
        //If user has mouse over the ui, then keep it active
        this.containerElement.onmouseover = function(){
            if(this.fadeoutID){
                clearTimeout(this.fadeoutID);   
            }
            
            this.containerElement.style.opacity = "1";
            app.canvasElement.style.cursor = "auto"; 
        }.bind(this);
        
        //When user moves mouse off ui, prepare it to fade back out again
        this.containerElement.onmouseout = function(){
            this.fadeoutID = setTimeout(function(){
                this.containerElement.style.opacity = "0";
                app.canvasElement.style.cursor = "none";
                
                this.fadeoutID = null;
            }.bind(this),3000);    
            
        }.bind(this);
        
    };
    
    
    return ui;//Return ui module   
})();