import { useMemo } from 'react'
import { EffectComposer, Bloom, Vignette, Outline } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { detectDevice } from '../game/deviceDetect'
import { useGameStore } from '../game/store'

/**
 * Bloom + vignette + soft-lock outline. Bloom disabled on touch devices;
 * vignette kept lighter so billboards and hit flashes stay readable.
 */
export function PostProcessing() {
  const mobile = useMemo(() => detectDevice().isTouch, [])
  const threat = useGameStore((s) => s.threat)

  const bloomIntensity = 0.2 + threat * 0.14
  const vignetteDarkness = 0.38 + threat * 0.22

  return (
    <EffectComposer autoClear={false} multisampling={mobile ? 0 : 4}>
      <Bloom
        intensity={mobile ? 0 : bloomIntensity}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.42}
      />
      <Vignette
        offset={0.3}
        darkness={mobile ? 0.26 : vignetteDarkness}
        eskil={false}
      />
      <Outline
        blur
        kernelSize={KernelSize.SMALL}
        edgeStrength={mobile ? 2.2 : 3}
        visibleEdgeColor={0xffdd66}
        hiddenEdgeColor={0x664422}
        xRay
        blendFunction={BlendFunction.ALPHA}
      />
    </EffectComposer>
  )
}
