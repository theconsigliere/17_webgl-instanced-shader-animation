import * as THREE from "three"
import fragment from "./shader/fragment.glsl"
import vertex from "./shader/vertex.glsl"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import gui from "lil-gui"
import gsap from "gsap"
import barModel from "../assets/bar.glb?url"
import barAmbientOcclusion from "../assets/ao.png?url"
import barFBO from "../assets/fbo.png?url"

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene()

    this.container = options.dom
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0x08092d, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.001,
      1000
    )

    let frustumSize = this.height
    let aspect = this.width / this.height
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      -2000,
      2000
    )
    this.camera.position.set(2, 2, 2)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.time = 0

    this.isPlaying = true

    this.gltfLoader = new GLTFLoader()

    this.addObjects()
    this.resize()
    this.render()
    this.setupResize()
    this.addLights()
    // this.settings()
  }

  settings() {
    this.settings = {
      progress: 0,
    }
    this.gui = new gui()
    this.gui.add(this.settings, "progress", 0, 1, 0.01)
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this))
  }

  resize() {
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer.setSize(this.width, this.height)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  addObjects() {
    this.aOTexture = new THREE.TextureLoader().load(barAmbientOcclusion)
    // set texture of the ambient occlusion
    this.aOTexture.flipY = false

    this.material = new THREE.MeshPhysicalMaterial({
      roughness: 0.65,
      map: this.aOTexture,
      aoMap: this.aOTexture,
      aoMapIntensity: 0.75,
    })

    // animate the material

    this.uniforms = {
      time: { value: 0 },
      uFBO: { value: new THREE.TextureLoader().load(barFBO) },
      aoMap: { value: this.aOTexture },
      light_color: { value: new THREE.Color("#ffe9e9") },
      ramp_color_one: { value: new THREE.Color("#06082D") },
      ramp_color_two: { value: new THREE.Color("#020284") },
      ramp_color_three: { value: new THREE.Color("#0000ff") },
      ramp_color_four: { value: new THREE.Color("#71c7f5") },
    }

    this.material.onBeforeCompile = (shader) => {
      // UPDATE SHADER
      // add all uniforms to the shader
      shader.uniforms = Object.assign(shader.uniforms, this.uniforms)
      // add the fragment and vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `
        uniform sampler2D uFBO;
        uniform float time;
        uniform vec3 light_color;
        uniform vec3 ramp_color_one;
        uniform vec3 ramp_color_two;
        uniform vec3 ramp_color_three;
        uniform vec3 ramp_color_four;
        attribute vec2 instanceUV;
        `
      )

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>

        vec4 transition = texture2D(uFBO, instanceUV);
        transformed *=(transition.g);
        `
      )
    }

    // create the model

    this.gltfLoader.load(barModel, (gltf) => {
      this.barModel = gltf.scene.children[0]
      this.scene.add(this.barModel)
      this.barModel.material = this.material
      this.geometry = this.barModel.geometry
      this.geometry.scale(40, 40, 40)

      // create the instanced mesh
      this.iSize = 50
      this.instances = this.iSize ** 2
      this.instanceMesh = new THREE.InstancedMesh(
        this.geometry,
        this.material,
        this.instances
      )

      let dummy = new THREE.Object3D()

      let width = 60 // width bigger than model set at 40 so there are gaps

      let instanceUV = new Float32Array(this.instances * 2) // 2 values per instance

      // use nested loops to create the grid of instances
      for (let i = 0; i < this.iSize; i++) {
        for (let j = 0; j < this.iSize; j++) {
          // get the full UVs of the model and add them to the instanceUV array
          instanceUV.set(
            [i / this.iSize, j / this.iSize],
            (i * this.iSize + j) * 2
          )

          dummy.position.set(
            width * (i - this.iSize / 2),
            0,
            width * (j - this.iSize / 2)
          )
          dummy.updateMatrix()
          this.instanceMesh.setMatrixAt(i * this.iSize + j, dummy.matrix)
        }
      }

      // add this so it can be manpulated by shader
      this.geometry.setAttribute(
        "instanceUV",
        new THREE.InstancedBufferAttribute(instanceUV, 2)
      )

      this.scene.add(this.instanceMesh)
    })
  }

  addLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    this.scene.add(this.ambientLight)

    // red spotlight coming from the top on blue mesh
    this.spotlight = new THREE.SpotLight(0xffe9e9, 1600)
    // position this above the instanced mesh (big numbers as the mesh is scaled up)
    this.spotlight.position.set(-80, 200, -80)
    // set it at an angle
    this.spotlight.target = new THREE.Object3D({
      position: new THREE.Vector3(0, -80, 200),
    })
    // intensity needs to be high to see the light
    this.spotlight.intensity = 60
    this.spotlight.angle = 1
    // how much gradient you get in the spotlight
    this.spotlight.penumbra = 1.5
    this.spotlight.decay = 0.7
    // how far the light goes
    this.spotlight.distance = 3000
    this.scene.add(this.spotlight)

    // this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    // this.directionalLight.position.set(0.5, 1, 0.86)
    // this.scene.add(this.directionalLight)
  }

  stop() {
    this.isPlaying = false
  }

  play() {
    if (!this.isPlaying) {
      this.render()
      this.isPlaying = true
    }
  }

  render() {
    if (!this.isPlaying) return
    this.time += 0.05
    // this.material.uniforms.time.value = this.time
    requestAnimationFrame(this.render.bind(this))
    this.renderer.render(this.scene, this.camera)
  }
}

new Sketch({
  dom: document.getElementById("container"),
})
