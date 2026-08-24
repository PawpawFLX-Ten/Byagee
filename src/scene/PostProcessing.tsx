import { useMemo } from 'react'
import { EffectComposer, Bloom, Vignette, Outline } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { detectDevice } from '../game/deviceDetect'
import { useGameStore } from '../game/store'

/**
 * Threat drifts as a float every tick; subscribing raw would re-render the
 * whole composer subtree at 60fps. Quantize to coarse steps — the eye can't
 * tell, and the reconciler stops thrashing.
 */
const THREAT_STEP = 0.05
const selectThreatQuantized = (s: { threat: number }) =>
  Math.round(s.threat / THREAT_STEP) * THREAT_STEP

/**
 * Bloom + vignette + soft-lock outline. Bloom unmounted on touch devices —
 * intensity=0 would still run the luminance extraction + mipmap blur chain,
 * which is exactly the bandwidth mobile can't afford.
 */
export function PostProcessing() {
  const mobile = useMemo(() => detectDevice().isTouch, [])
  const threat = useGameStore(selectThreatQuantized)

  const bloomIntensity = 0.2 + threat * 0.14
  const vignetteDarkness = 0.38 + threat * 0.22

  return (
    <EffectComposer autoClear={false} multisampling={mobile ? 0 : 4}>
      {!mobile ? (
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.92}
          luminanceSmoothing={0.4}
          mipmapBlur
          radius={0.42}
        />
      ) : (
        <></>
      )}
      <Vignette
        offset={0.3}
        darkness={mobile ? 0.26 : vignetteDarkness}
        eskil={false}
      />
      {!mobile ? (
        <Outline
          blur
          kernelSize={KernelSize.SMALL}
          edgeStrength={3}
          visibleEdgeColor={0xffdd66}
          hiddenEdgeColor={0x664422}
          xRay
          blendFunction={BlendFunction.ALPHA}
        />
      ) : (
        <></>
      )}
    </EffectComposer>
  )
}
