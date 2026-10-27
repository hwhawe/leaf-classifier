// diseaseInfo.js
// OLID-I menamai kelasnya dengan pola: <Nama Tanaman> + <Kode Kondisi>
// Kode kondisi bisa berupa singkatan penyakit/hama, atau kombinasi unsur hara
// yang kekurangan (mis. "K" = Kalium, "K Mg" = Kalium + Magnesium sekaligus).
// Modul ini mem-parsing label mentah dari model lalu mengembalikan penjelasan.

const CROPS = [
  { match: ['ash gourd', 'ashgourd'], id: 'Labu Putih (Ash Gourd)' },
  { match: ['bitter gourd', 'bittergourd'], id: 'Pare (Bitter Gourd)' },
  { match: ['bottle gourd', 'bottlegourd'], id: 'Labu Botol (Bottle Gourd)' },
  { match: ['ridge gourd', 'ridgegourd'], id: 'Oyong / Gambas (Ridge Gourd)' },
  { match: ['snake gourd', 'snakegourd'], id: 'Labu Ular (Snake Gourd)' },
  { match: ['cucumber'], id: 'Mentimun' },
  { match: ['eggplant', 'brinjal'], id: 'Terong' },
  { match: ['tomato'], id: 'Tomat' },
]

// Kode kondisi tunggal. Kode gabungan (mis. "K Mg", "N K") ditangani otomatis
// dengan menggabungkan penjelasan tiap unsur.
const CODES = {
  healthy: {
    category: 'Sehat',
    title: 'Daun Sehat',
    description: 'Tidak ada gejala penyakit, hama, atau kekurangan unsur hara yang terdeteksi pada daun.',
    tip: 'Pertahankan pola penyiraman dan pemupukan rutin.',
  },
  pm: {
    category: 'Penyakit (Jamur)',
    title: 'Powdery Mildew (Embun Tepung)',
    description: 'Infeksi jamur yang muncul sebagai lapisan bubuk putih di permukaan daun, dapat menghambat fotosintesis.',
    tip: 'Perbaiki sirkulasi udara antar tanaman dan pertimbangkan fungisida berbahan dasar sulfur.',
  },
  dm: {
    category: 'Penyakit (Jamur)',
    title: 'Downy Mildew (Embun Bulu)',
    description: 'Bercak kuning-cokelat di permukaan atas daun disertai lapisan seperti kapas keabuan di bagian bawah.',
    tip: 'Kurangi kelembapan berlebih dan hindari penyiraman dari atas daun.',
  },
  ls: {
    category: 'Penyakit',
    title: 'Leaf Spot (Bercak Daun)',
    description: 'Bercak berwarna cokelat hingga kehitaman pada permukaan daun akibat infeksi jamur atau bakteri.',
    tip: 'Buang daun yang terinfeksi dan hindari penyiraman yang membasahi daun.',
  },
  jas: {
    category: 'Hama (Serangga)',
    title: 'Jassid (Wereng Daun)',
    description: 'Serangga kecil penghisap cairan daun, menyebabkan daun menguning, mengeriting, dan tepi daun terbakar (hopper burn).',
    tip: 'Gunakan perangkap kuning lengket atau insektisida nabati sesuai anjuran.',
  },
  mit: {
    category: 'Hama',
    title: 'Tungau (Mite)',
    description: 'Hama mikroskopis yang mengisap cairan daun, menimbulkan bintik keperakan/pucat dan jaring halus.',
    tip: 'Semprot air bertekanan atau gunakan akarisida bila serangan parah.',
  },
  n: {
    category: 'Defisiensi Nutrisi',
    title: 'Kekurangan Nitrogen (N)',
    description: 'Daun tua menguning merata (klorosis), pertumbuhan tanaman melambat dan kerdil.',
    tip: 'Tambahkan pupuk sumber nitrogen seperti urea atau kompos kaya N.',
  },
  k: {
    category: 'Defisiensi Nutrisi',
    title: 'Kekurangan Kalium (K)',
    description: 'Tepi daun menguning lalu mengering dan terbakar (leaf scorch), sering dimulai dari daun tua.',
    tip: 'Tambahkan pupuk sumber kalium seperti KCl atau abu kayu.',
  },
  mg: {
    category: 'Defisiensi Nutrisi',
    title: 'Kekurangan Magnesium (Mg)',
    description: 'Klorosis di antara tulang daun (interveinal) pada daun tua, sementara tulang daun tetap hijau.',
    tip: 'Tambahkan pupuk Epsom salt (MgSO4) sesuai dosis anjuran.',
  },
}

function normalize(str) {
  return str
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function explainLabel(rawLabel) {
  const norm = normalize(rawLabel)

  const crop = CROPS.find((c) => c.match.some((m) => norm.includes(m)))
  const cropName = crop ? crop.id : null

  let remainder = norm
  if (crop) {
    crop.match.forEach((m) => {
      remainder = remainder.replace(m, '')
    })
  }
  remainder = remainder.trim()

  if (!remainder || remainder === 'healthy') {
    const info = CODES.healthy
    return { crop: cropName, ...info }
  }

  // Cari kombinasi kode dua kata dulu (mis. "jas mit"), baru kode tunggal
  const tokens = remainder.split(' ').filter(Boolean)
  const matchedCodes = []
  let i = 0
  while (i < tokens.length) {
    const twoWord = tokens.slice(i, i + 2).join(' ')
    if (CODES[twoWord.replace(' ', '')] && tokens[i] === 'jas' && tokens[i + 1] === 'mit') {
      matchedCodes.push(CODES.mit)
      i += 2
      continue
    }
    const single = tokens[i]
    if (CODES[single]) {
      matchedCodes.push(CODES[single])
    }
    i += 1
  }

  if (matchedCodes.length === 0) {
    return {
      crop: cropName,
      category: 'Tidak diketahui',
      title: rawLabel.replace(/_/g, ' '),
      description: 'Deskripsi untuk kelas ini belum tersedia di kamus istilah.',
      tip: null,
    }
  }

  if (matchedCodes.length === 1) {
    return { crop: cropName, ...matchedCodes[0] }
  }

  // Kode gabungan, mis. defisiensi K + Mg sekaligus
  return {
    crop: cropName,
    category: matchedCodes[0].category,
    title: matchedCodes.map((m) => m.title).join(' + '),
    description: matchedCodes.map((m) => m.description).join(' '),
    tip: matchedCodes.map((m) => m.tip).filter(Boolean).join(' '),
  }
}
