import { DistribuicaoDFe } from 'node-mde';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { action, ultNSU, chave, nsu, location } = req.body;

  const locationConfigs = {
    'Caratinga': { pfxEnv: 'PFX_CERTIFICATE', passEnv: 'PFX_PASSWORD', cnpj: '11802464000138' },
    'Ponte Nova': { pfxEnv: 'PFX_CERTIFICATE_PN', passEnv: 'PFX_PASSWORD_PN', cnpj: '53824315000110' },
  };

  const config = locationConfigs[location || 'Caratinga'];
  if (!config) {
    return res.status(400).json({ error: 'Localização inválida.' });
  }

  const pfxBase64 = process.env[config.pfxEnv];
  const pfxPassword = process.env[config.passEnv];

  if (!pfxBase64 || !pfxPassword) {
    return res.status(500).json({ error: `Certificado PFX não configurado para ${location || 'Caratinga'}.` });
  }

  try {
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');

    const distribuicao = new DistribuicaoDFe({
      pfx: pfxBuffer,
      passphrase: pfxPassword,
      cnpj: config.cnpj,
      cUFAutor: '31',
      tpAmb: '1',
    });

    let result;

    if (action === 'sync') {
      result = await distribuicao.consultaUltNSU(ultNSU || '000000000000000');
    } else if (action === 'consultaChave') {
      if (!chave) {
        return res.status(400).json({ error: 'Chave de acesso não informada.' });
      }
      result = await distribuicao.consultaChNFe(chave);
    } else if (action === 'consultaNSU') {
      if (!nsu) {
        return res.status(400).json({ error: 'NSU não informado.' });
      }
      result = await distribuicao.consultaNSU(nsu);
    } else {
      return res.status(400).json({ error: 'Ação inválida.' });
    }

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    const data = result.data || result;

    return res.status(200).json({
      cStat: data.cStat,
      xMotivo: data.xMotivo,
      ultNSU: data.ultNSU,
      maxNSU: data.maxNSU,
      documents: data.docZip || [],
    });
  } catch (error) {
    console.error('SEFAZ API Error:', error);
    return res.status(500).json({
      error: 'Erro ao comunicar com SEFAZ',
      details: error.message,
    });
  }
}
