import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 100 outfit prompts × varied poses = realistic GF-style images
const POSES = [
  'lying down on the floor with legs resting on the sofa, casual relaxed mood',
  'hiding face playfully with one hand, shy smile peeking through fingers',
  'blowing a flying kiss at the camera, soft flirty expression',
  'messy hair and just-woke-up look, sitting on bed in morning light',
  'taking a selfie in the mirror with natural soft lighting',
  'sitting cross-legged on the floor, looking down with a soft smile',
  'standing by the window with natural light, looking outside pensively',
  'leaning against a wall with a confident playful smile',
  'sitting on a kitchen counter holding a coffee mug',
  'twirling playfully, dress or outfit spinning, laughing naturally',
  'lying on the bed looking at the camera with a soft warm smile',
  'sitting on the floor with back against the sofa, phone in hand',
  'candid laughing moment, head tilted back slightly',
  'standing in a balcony with the wind blowing hair',
  'looking over shoulder at camera with a subtle smile',
  'hands in hair, tousling it playfully',
  'sitting at a cafe table with a drink, looking dreamily away',
  'walking and looking back at the camera smiling',
  'lying on a beach or floor, hand under chin, looking at camera',
  'drying hair with a towel, candid natural moment',
]

const OUTFITS = [
  { outfit: 'light blue ripped jeans with white crop top and silver hoops', category: 'casual' },
  { outfit: 'black skinny jeans with oversized pastel pink T-shirt', category: 'casual' },
  { outfit: 'dark blue mom jeans with floral yellow top', category: 'casual' },
  { outfit: 'grey leggings with black sports bra and white sneakers', category: 'sporty' },
  { outfit: 'lavender lingerie with lace detailing', category: 'lingerie' },
  { outfit: 'satin red nighty with delicate embroidery', category: 'nighty' },
  { outfit: 'royal blue silk saree with golden border', category: 'traditional' },
  { outfit: 'mint green salwar suit with floral dupatta', category: 'traditional' },
  { outfit: 'maroon wedding lehanga with heavy zari work', category: 'bridal' },
  { outfit: 'white beach wear kaftan with shell jewelry', category: 'beach' },
  { outfit: 'turquoise swimwear with tropical print', category: 'swimwear' },
  { outfit: 'cream bathrobe with wet hair look', category: 'bathrobe' },
  { outfit: 'fluffy white towel wrap after shower', category: 'towel' },
  { outfit: 'denim shorts with striped tank top', category: 'casual' },
  { outfit: 'black mini skirt with fitted red blouse', category: 'going out' },
  { outfit: 'beige long skirt with boho white top', category: 'boho' },
  { outfit: 'blue jeans and black turtleneck wearing glasses', category: 'smart' },
  { outfit: 'floral maxi dress wearing straw hat', category: 'summer' },
  { outfit: 'olive cargo jeans with fitted beige T-shirt', category: 'casual' },
  { outfit: 'white leggings with peach sports bra', category: 'sporty' },
  { outfit: 'emerald green lingerie with satin robe', category: 'lingerie' },
  { outfit: 'pastel pink nighty with lace sleeves', category: 'nighty' },
  { outfit: 'ivory saree with pearl jewelry', category: 'traditional' },
  { outfit: 'mustard yellow salwar suit with mirror work', category: 'traditional' },
  { outfit: 'blush pink bridal lehanga with crystals', category: 'bridal' },
  { outfit: 'neon beach co-ord set with sunglasses', category: 'beach' },
  { outfit: 'black one-piece swimwear with mesh design', category: 'swimwear' },
  { outfit: 'satin champagne bathrobe near vanity mirror', category: 'bathrobe' },
  { outfit: 'towel wrap and pearl earrings', category: 'towel' },
  { outfit: 'white cotton shorts with oversized hoodie', category: 'cozy' },
  { outfit: 'plaid mini skirt with fitted crop jacket', category: 'going out' },
  { outfit: 'flowy floral long skirt with sleeveless blouse', category: 'summer' },
  { outfit: 'ripped jeans and oversized hoodie wearing glasses', category: 'casual' },
  { outfit: 'wide hat with white summer dress', category: 'summer' },
  { outfit: 'black jeans with neon green top', category: 'casual' },
  { outfit: 'faded jeans with anime graphic T-shirt', category: 'casual' },
  { outfit: 'grey leggings with neon pink sports bra', category: 'sporty' },
  { outfit: 'baby blue lingerie with sheer lace', category: 'lingerie' },
  { outfit: 'velvet wine-red nighty', category: 'nighty' },
  { outfit: 'red Banarasi saree with temple jewelry', category: 'traditional' },
  { outfit: 'pastel peach salwar suit with chikankari work', category: 'traditional' },
  { outfit: 'gold wedding lehanga with royal dupatta', category: 'bridal' },
  { outfit: 'crochet beach wear with pearl anklet', category: 'beach' },
  { outfit: 'sporty red swimwear with visor cap', category: 'swimwear' },
  { outfit: 'soft cotton bathrobe with messy bun', category: 'bathrobe' },
  { outfit: 'towel outfit with spa aesthetic', category: 'towel' },
  { outfit: 'biker shorts with oversized sweatshirt', category: 'sporty' },
  { outfit: 'leather mini skirt with black corset top', category: 'going out' },
  { outfit: 'pleated satin long skirt with fitted top', category: 'elegant' },
  { outfit: 'casual jeans and white shirt wearing glasses', category: 'smart' },
  { outfit: 'floppy hat and floral beach dress', category: 'beach' },
  { outfit: 'white high-waist jeans with lavender top', category: 'casual' },
  { outfit: 'blue baggy jeans with vintage band T-shirt', category: 'casual' },
  { outfit: 'black leggings with white sports bra', category: 'sporty' },
  { outfit: 'pink lace lingerie with satin gloves', category: 'lingerie' },
  { outfit: 'silk ivory nighty with soft fur slippers', category: 'nighty' },
  { outfit: 'emerald saree with silver embroidery', category: 'traditional' },
  { outfit: 'sky blue salwar suit with pearl buttons', category: 'traditional' },
  { outfit: 'traditional red bridal lehanga with veil', category: 'bridal' },
  { outfit: 'tropical beach shorts and loose shirt', category: 'beach' },
  { outfit: 'metallic silver swimwear with beach hat', category: 'swimwear' },
  { outfit: 'luxury white bathrobe with candlelight ambiance', category: 'bathrobe' },
  { outfit: 'towel dress with natural makeup', category: 'towel' },
  { outfit: 'sporty shorts with fitted crop hoodie', category: 'sporty' },
  { outfit: 'denim mini skirt with floral blouse', category: 'casual' },
  { outfit: 'ethnic printed long skirt with mirror top', category: 'boho' },
  { outfit: 'black-rim glasses with elegant office wear', category: 'smart' },
  { outfit: 'fedora hat with beige trench dress', category: 'elegant' },
  { outfit: 'distressed jeans with satin black top', category: 'casual' },
  { outfit: 'white jeans with striped oversized T-shirt', category: 'casual' },
  { outfit: 'yoga leggings with purple sports bra', category: 'sporty' },
  { outfit: 'luxury black lace lingerie set', category: 'lingerie' },
  { outfit: 'champagne satin nighty with lace trim', category: 'nighty' },
  { outfit: 'pastel organza saree with sequins', category: 'traditional' },
  { outfit: 'bottle green salwar suit with gold embroidery', category: 'traditional' },
  { outfit: 'lavender bridal lehanga with diamond jewelry', category: 'bridal' },
  { outfit: 'printed beach kimono and bikini set', category: 'beach' },
  { outfit: 'sporty blue swimwear with sunglasses', category: 'swimwear' },
  { outfit: 'pink bathrobe with fluffy slippers', category: 'bathrobe' },
  { outfit: 'towel wrap with wet curly hair', category: 'towel' },
  { outfit: 'white shorts with floral kimono jacket', category: 'casual' },
  { outfit: 'black mini skirt with oversized sweater', category: 'going out' },
  { outfit: 'layered long skirt with artistic blouse', category: 'boho' },
  { outfit: 'nerdy glasses with pastel co-ord set', category: 'smart' },
  { outfit: 'sun hat with yellow beach maxi dress', category: 'beach' },
  { outfit: 'cargo jeans with fitted maroon crop top', category: 'casual' },
  { outfit: 'oversized jeans with cute cartoon T-shirt', category: 'casual' },
  { outfit: 'gym leggings with orange sports bra', category: 'sporty' },
  { outfit: 'elegant white lingerie with pearls', category: 'lingerie' },
  { outfit: 'floral satin nighty with silk robe', category: 'nighty' },
  { outfit: 'navy blue saree with minimal jewelry', category: 'traditional' },
  { outfit: 'cream salwar suit with floral prints', category: 'traditional' },
  { outfit: 'royal purple wedding lehanga with embroidery', category: 'bridal' },
  { outfit: 'bohemian beach wear with shell necklace', category: 'beach' },
  { outfit: 'black monokini swimwear with beach scarf', category: 'swimwear' },
  { outfit: 'luxurious hotel bathrobe near balcony', category: 'bathrobe' },
  { outfit: 'towel look with spa candles background', category: 'towel' },
  { outfit: 'denim shorts with sporty tank top', category: 'casual' },
  { outfit: 'velvet mini skirt with shimmer blouse', category: 'going out' },
  { outfit: 'elegant pleated long skirt with pearl crop top', category: 'elegant' },
]

export async function POST() {
  try {
    // Clear existing prompts first
    await supabaseAdmin.from('prompts').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const prompts = OUTFITS.map((item, i) => {
      const pose = POSES[i % POSES.length]
      return {
        style_name: item.category,
        pose_name: pose.split(',')[0].trim(), // Short label
        prompt_text: `Photorealistic portrait of a Beautiful Indian woman wearing ${item.outfit}. She is ${pose}. The image should look completely natural and candid, like a real photo she would send to her boyfriend or post on Instagram. Soft warm lighting, high resolution, authentic Indian facial features, natural skin tone. The outfit fits perfectly and looks real.`,
      }
    })

    const { error } = await supabaseAdmin.from('prompts').insert(prompts)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, count: prompts.length, message: `Seeded ${prompts.length} prompts successfully!` })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
