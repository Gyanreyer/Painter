'use strict';

var app = app || {};

app.watercolor = (function(){
    
    var watercolor = {};//Watercolor module object to export to app

    watercolor.init = function(){         
        //Initialize size of canvas to fill screen on load - it'll stretch on resize but ehhhh just reload it
        this.WIDTH = window.innerWidth;
        this.HEIGHT = window.innerHeight;
        
        this.paused = true;//Whether simulation is paused (or playing if false)

        //Load in text of shaders to use
        var vShaderBuf = document.querySelector("#vShader-buf").innerHTML;//Vert shader for rendering buffer texture
        var fShaderBuf = document.querySelector("#fShader-buf").innerHTML;//Frag shader for rendering buffer texture - this is where the magic texture manipulation happens
        var vShaderDisplay = document.querySelector("#vShader-display").innerHTML;//Shaders for display scene much less important - basically just draw the texture that's given in uniform
        var fShaderDisplay = document.querySelector("#fShader-display").innerHTML;

        this.setUpTextures();
              
        this.renderToScene = new THREE.Scene();//Scene to render to for simulation, user won't actually see this
        this.renderToCam = new THREE.OrthographicCamera(this.WIDTH/-2,this.WIDTH/2, this.HEIGHT/2, this.HEIGHT/-2,-100,100);//Camera for rendering simulation
        this.renderToScene.add(this.renderToCam);//Add camera to scene

        this.mainScene = new THREE.Scene();//Scene for rendering to screen
        this.mainCamera = new THREE.OrthographicCamera(this.WIDTH/-2,this.WIDTH/2, this.HEIGHT/2, this.HEIGHT/-2,-100,100);//Camera for rendering to screen
        this.mainScene.add(this.mainCamera);//Add camera to scene
        
        this.state = 0;//State of app, corresponds to state uniform in shader - 0 = not started, 1 = starting/just clicked, 2 = running
        
        //Set up shader for simulation/updating texture each frmae
        this.simulationShader = new THREE.ShaderMaterial({
            uniforms: {
                "uWidth":{type:"f", value: this.WIDTH},//Pass in width/height of screen to shader
                "uHeight":{type:"f", value: this.HEIGHT},
                "randSeed":{type:"f", value: Math.random()*256.0},//Pass in a new random num each frame to help enhance randomness in shader
                "mouseCoords":{type:"v2",value:new THREE.Vector2(0.0,0.0)},//Coords of where user clicked, will draw outward from this point
                "state":{type:"i",value:0},//State of shader
                "randomColorMod":{type:"v3",value: new THREE.Vector3(Math.random(),Math.random(),Math.random())},//Vector of random nums for additional seeding of rgb values
                "tCurrentFront":{type:"t",value: this.currentTarget.texture}//Texture to render to/modify
            },
            vertexShader: vShaderBuf,//Shaders to use
            fragmentShader: fShaderBuf   
        });
        
        //Render simulation to a flat plane the size of screen
        var renderToPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(this.WIDTH,this.HEIGHT), this.simulationShader);
        renderToPlane.position.z = -100;
        this.renderToScene.add(renderToPlane);
        
        //Set up shader for displaying final tex each frame
        this.displayShader = new THREE.ShaderMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            uniforms: {
                "tDiffuse":{type:"t", value:this.currentFront.texture}//Pass in texture for it to render to screen
            },
            vertexShader: vShaderDisplay,
            fragmentShader: fShaderDisplay    
        });

        //Render to flat plane size of screen
        var displayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(this.WIDTH,this.HEIGHT), this.displayShader);
        this.mainScene.add(displayPlane);
        
        //Create renderer for drawing to texture and rendering to screen - aplha: true means that transparent portions of screen will simply not be drawn
        this.renderer = new THREE.WebGLRenderer({ alpha: true });
        this.renderer.setSize(this.WIDTH,this.HEIGHT);//Set size of renderer to screen size

        document.body.appendChild(this.renderer.domElement);//Append canvas from renderer to doc - this is what will be renderer to each frame
        
        app.canvasElement = this.renderer.domElement;//Store canvas so it's easily accessible for future operations
        
        //Set up click event to start new animation from point where user clicked
        app.canvasElement.onclick = function(e){
            this.clickEvent(new THREE.Vector2((e.clientX/window.innerWidth)*this.WIDTH,
                                    (1-e.clientY/window.innerHeight)*this.HEIGHT));
        }.bind(this);
        
        this.playPauseButton = document.querySelector("#playPause");//Set up button to play/pause app
            
        //Either pause or play depending on current state
        this.playPauseButton.onclick = function(){
            if(this.paused)
                this.play();    
            else
                this.pause();
        }.bind(this);
        
        this.clock = new THREE.Clock();//Set up clock for counting up elapsed time      
        
        this.animID = null;//ID for animation frame, used to cancel animation
        
        this.nextCheckTime = 0;//Next time to check whether done yet
        this.nextCheckTimeInterval = 1;//Interval in seconds to make check - every one second isn't too bad now after optimization
        
    };

    //Call when canvas is clicked to start simulation from the click point
    watercolor.clickEvent = function(clickPos){               
        this.pause();
        
        //Sim is currently in paused state, put it in play state to get it going
        if(this.paused){
            if(this.state === 0){//If haven't started anything yet, we need to fade out click prompt first         
                document.querySelector("#beginText").style.opacity = "0";
            }
            
            this.playPauseButton.removeAttribute("disabled");//Enable pause button
            
            this.play();//Start playing
        }
        
        //If the sim has already been running, need to reset texture stuff
        if (this.state === 2){
            //this.init();
            this.setUpTextures();//Reset textures
            this.simulationShader.uniforms.tCurrentFront.value = this.currentFront.texture;//Update shader textures
            this.displayShader.uniforms.tDiffuse.value = this.currentFront.texture;  
        }

        //Give new mouse coords to shader and reset its state to start the sim from that point
        this.simulationShader.uniforms.mouseCoords.value = clickPos;
        this.simulationShader.uniforms.state.value = this.state = 1; 
        
        this.play();
    };
    
    //Set up textures to draw to - placed in a function for easy reusability since these all have to be reset when you start a new sim
    watercolor.setUpTextures = function(){
        //Make 2 render targets to draw to/manipulate - swap these back and forth each frame
        this.frontTarget = new THREE.WebGLRenderTarget(this.WIDTH,this.HEIGHT,
            {minFilter: THREE.NearestFilter,maxFilter: THREE.NearestFilter, stencilBuffer: false, depthBuffer: false});

        this.backTarget = new THREE.WebGLRenderTarget(this.WIDTH,this.HEIGHT,
            {minFilter: THREE.NearestFilter,maxFilter: THREE.NearestFilter, stencilBuffer: false, depthBuffer: false});

        //Set up properties of textures, WITHOUT THIS IT'S BROKEN AS HELL ON MOBILE
        this.frontTarget.texture.wrapS = this.frontTarget.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.backTarget.texture.wrapS = this.backTarget.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.frontTarget.texture.magFilter = THREE.NearestFilter;
        this.backTarget.texture.magFilter = THREE.NearestFilter;        
        
        this.currentFront = this.frontTarget;//Texture to display this frame
        this.currentTarget = this.backTarget;//Texture to render to from simulation this frame 
    };
    
    //Stop the animation from continuing to update
    watercolor.pause = function(){
        if(this.paused) return;
        
        this.paused = true;//Change state to paused
    
        //Update appearance of play/pause button to show it's paused
        this.playPauseButton.children[0].className = "fa fa-play";
        this.playPauseButton.className="btn btn-warning"; 
        
        this.clock.stop();//Stop the clock since it's pointless to run when anim isn't running
        cancelAnimationFrame(this.animID);//Cancel the next update/frame of the anim from being played   
    };
    
    //Start animation from paused state
    watercolor.play = function(){
        if(!this.paused) return;
        
        this.paused = false;//Change state to not paused
        
        //Update appearance of button
        this.playPauseButton.children[0].className = "fa fa-pause";
        this.playPauseButton.className="btn btn-success";
        
        //Start clock back up and set next time to check if done based on interval
        this.clock.start();
        this.nextCheckTime = this.clock.elapsedTime + this.nextCheckTimeInterval;
        
        this.update();//Start up the update loop   
    };
       
    //Update loop runs ~60x per second until paused
    watercolor.update = function(){     
        
        this.renderNextTex();//Do simulation render to update texture and stuff with shader
        
        this.renderer.render(this.mainScene,this.mainCamera);//Then render actual scene for user to see
        
        //If an interval has passed, make a check to see if done yet
        if(this.clock.getElapsedTime() > this.nextCheckTime){
            this.nextCheckTime = this.clock.elapsedTime+this.nextCheckTimeInterval;//Next time to check based on interval
            
            //Check if the corner pixels have all been colored yet, if so then stop because we're done
            if(this.checkIfDone()){
                this.pause();//Pause the sim
                this.playPauseButton.setAttribute("disabled","disabled");//Disable the play/pause button because we don't need it
                return;//Return early, don't want to request another frame because anim is done!
            }
        }
        
        this.animID = requestAnimationFrame(this.update.bind(this));//Request next update call for animation
    };

    //Manipulate the textures so we can draw a cool animation with it!
    watercolor.renderNextTex = function(){
        this.renderer.render(this.renderToScene,this.renderToCam,this.currentTarget,true);//Render buffer scene, this will render to currentTarget texture

        //If we're in start state, switch to running state so shader can move on from setting initial pixel
        if(this.state === 1){
            this.simulationShader.uniforms.state.value = this.state = 2;
        }

        //Swap textures to draw to/display
        if(this.currentFront === this.frontTarget){
            this.currentFront = this.backTarget;
            this.currentTarget = this.frontTarget;
        }
        else{
            this.currentFront = this.frontTarget;
            this.currentTarget = this.backTarget;
        }
    
        //Give shader new random seeds
        this.simulationShader.uniforms.randSeed.value = Math.random()*512;
        this.simulationShader.uniforms.randomColorMod.value = new THREE.Vector3(Math.random(),Math.random(),Math.random());

        //Update texture uniforms for shaders
        this.simulationShader.uniforms.tCurrentFront.value = this.currentFront.texture;
        this.displayShader.uniforms.tDiffuse.value = this.currentFront.texture;
    };    
    
    //Check if the simulation is done yet every given interval
    watercolor.checkIfDone = function(){
        
        var gl = this.renderer.context;//Get webgl context that we're going to check
        var pixels = new Uint8Array(4);//ArrayBuffer will hold data for pixel that we're checking
        
        //Check pixels in all 4 corners - if color has reached all corners then the simulation must have completed, so we can skip a lot of unnecessary looping
        for(var x = 0; x < this.WIDTH; x+= this.WIDTH-1){
            for(var y = 0; y < this.HEIGHT; y+= this.HEIGHT-1){
                gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);//Read the pixel at current corner
                
                if(pixels[3] === 0) return false;//If alpha of this pixel is 0, return early that not all pixels have been colored
            }            
        }
        
        return true;//If we've made it all the way through all 4 corners and they all hvae color, return that we're done!
    };
    
    //Renders main scene, need to call this when saving a screenshot so that the image data will be in the frame buffer when we transfer it to another canvas and save
    watercolor.renderDisplay = function(){
        this.renderer.render(this.mainScene,this.mainCamera);
    };
    
    return watercolor;//Return watercolor module to attach to app
    
})();