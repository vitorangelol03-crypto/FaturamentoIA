import { Receipt, Category, SefazNote } from '../types';

declare global {
  interface Window {
    jspdf: any;
  }
}

async function fetchImageAsBlob(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function canvasConvert(imgSrc: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível criar contexto canvas'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegDataUrl);
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => reject(new Error('Falha ao carregar imagem no canvas'));
    img.src = imgSrc;
  });
}

async function convertImageToJpegBase64(src: string, quality: number = 0.85): Promise<string> {
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) {
    return src;
  }

  if (src.startsWith('data:')) {
    return canvasConvert(src, quality);
  }

  try {
    return await canvasConvert(src, quality);
  } catch (_corsErr) {
    console.warn('Canvas CORS falhou, tentando fetch como blob...');
    const blobDataUri = await fetchImageAsBlob(src);
    return canvasConvert(blobDataUri, quality);
  }
}

export const generateSingleReceiptPDF = async (receipt: Receipt, categoryName: string) => {
    if (!window.jspdf) {
        alert("PDF library not loaded. Please check your internet connection.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // -- Header Style --
    doc.setFillColor(2, 132, 199); // Brand Blue
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(receipt.establishment, 14, 20); // Title
    
    doc.setFontSize(10);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    // -- Info Section --
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    let yPos = 55;
    
    // Left Column
    doc.setFont(undefined, 'bold');
    doc.text("Data:", 14, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR'), 40, yPos);
    
    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text("Valor Total:", 14, yPos);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(14);
    doc.text(`R$ ${Number(receipt.total_amount).toFixed(2)}`, 40, yPos);
    doc.setFontSize(12);

    yPos += 10;
    doc.setFont(undefined, 'bold');
    doc.text("Categoria:", 14, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(categoryName, 40, yPos);

    // Right Column (offset x = 110)
    let yPosRight = 55;
    if (receipt.payment_method) {
        doc.setFont(undefined, 'bold');
        doc.text("Pagamento:", 110, yPosRight);
        doc.setFont(undefined, 'normal');
        doc.text(receipt.payment_method, 140, yPosRight);
        yPosRight += 8;
    }
    
    if (receipt.cnpj) {
        doc.setFont(undefined, 'bold');
        doc.text("CNPJ:", 110, yPosRight);
        doc.setFont(undefined, 'normal');
        doc.text(receipt.cnpj, 140, yPosRight);
    }

    yPos = Math.max(yPos, yPosRight) + 15;

    // -- Items Table (if exists) --
    if (receipt.items && receipt.items.length > 0) {
        const tableData = receipt.items.map(item => [
            item.name,
            item.quantity.toString(),
            `R$ ${item.unitPrice?.toFixed(2) || '0.00'}`,
            `R$ ${item.totalPrice?.toFixed(2) || '0.00'}`
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Item', 'Qtd', 'Unitário', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [100, 100, 100] },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
    } else {
        yPos += 10;
    }

    if (receipt.image_url) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("Comprovante Anexo", 14, yPos);
        yPos += 5;
        
        try {
            const jpegData = await convertImageToJpegBase64(receipt.image_url);
            const imgProps = doc.getImageProperties(jpegData);
            const pdfWidth = doc.internal.pageSize.getWidth() - 28;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            if (yPos + pdfHeight > 280) {
                doc.addPage();
                yPos = 20;
            }

            doc.addImage(jpegData, 'JPEG', 14, yPos, pdfWidth, pdfHeight, undefined, 'FAST');
        } catch (e) {
            console.error("Erro ao converter/adicionar imagem ao PDF:", e);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text('[Não foi possível carregar a imagem]', 14, yPos + 5);
        }
    }

    // Filename
    const cleanName = receipt.establishment.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 15);
    doc.save(`${cleanName}_${receipt.date}.pdf`);
};

export const generatePDFReport = async (
  receipts: Receipt[], 
  categories: Category[], 
  startDate: string, 
  endDate: string,
  includeImages: boolean
) => {
  if (!window.jspdf) {
    alert("PDF library not loaded. Please check your internet connection.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // -- Header --
  doc.setFontSize(22);
  doc.setTextColor(0, 51, 153);
  doc.text("Relatório de Despesas", 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Período: ${startDate} a ${endDate}`, 14, 30);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

  // -- Executive Summary --
  const totalSpent = receipts.reduce((acc, r) => acc + Number(r.total_amount), 0);
  const totalNotes = receipts.length;
  const avgTicket = totalNotes > 0 ? totalSpent / totalNotes : 0;

  doc.setFillColor(240, 249, 255);
  doc.roundedRect(14, 45, 180, 25, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text("Total Gasto", 20, 52);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`R$ ${totalSpent.toFixed(2)}`, 20, 60);

  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text("Qtd. Notas", 80, 52);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`${totalNotes}`, 80, 60);

  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text("Ticket Médio", 140, 52);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`R$ ${avgTicket.toFixed(2)}`, 140, 60);

  // -- Table --
  const tableData = receipts.map(r => {
    const catName = categories.find(c => c.id === r.category_id)?.name || 'Desconhecido';
    return [
      new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR'),
      r.establishment,
      catName,
      `R$ ${Number(r.total_amount).toFixed(2)}`
    ];
  });

  doc.autoTable({
    startY: 80,
    head: [['Data', 'Estabelecimento', 'Categoria', 'Valor']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [2, 132, 199] },
  });

  let finalY = (doc as any).lastAutoTable.finalY;

  // -- Images (Merged) --
  if (includeImages) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Anexos - Notas Fiscais", 14, 20);
    let yPos = 30;
    
    for (let index = 0; index < receipts.length; index++) {
       const r = receipts[index];
       if (r.image_url) {
           if (yPos > 250) {
               doc.addPage();
               yPos = 20;
           }
           
           try {
               const jpegData = await convertImageToJpegBase64(r.image_url);
               doc.setFontSize(10);
               doc.text(`Nota #${index + 1}: ${r.establishment} - ${r.date}`, 14, yPos);
               doc.addImage(jpegData, 'JPEG', 14, yPos + 5, 80, 100, undefined, 'FAST'); 
               yPos += 115;
           } catch (e) {
               console.error("Erro ao converter/adicionar imagem ao PDF:", e);
               doc.text(`[Erro ao carregar imagem para Nota #${index+1}]`, 14, yPos + 10);
               yPos += 20;
           }
       }
    }
  }

  doc.save('relatorio_notas.pdf');
};

const formatCNPJ = (cnpj?: string) => {
  if (!cnpj) return '-';
  const c = cnpj.replace(/\D/g, '');
  if (c.length === 14) {
    return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (c.length === 11) {
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cnpj;
};

const formatChaveAcesso = (chave?: string) => {
  if (!chave) return '-';
  return chave.replace(/(.{4})/g, '$1 ').trim();
};

const formatDateBR = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr.slice(0, 10);
  }
};

const formatCurrencyBR = (value?: number) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const generateDanfePDF = async (note: SefazNote, linkedReceiptImageUrl?: string) => {
  if (!window.jspdf) {
    alert("Biblioteca PDF não carregada. Verifique sua conexão.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(2, 132, 199);
  doc.rect(0, 0, pageWidth, 12, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA', pageWidth / 2, 8, { align: 'center' });

  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.5);
  doc.rect(10, 16, pageWidth - 20, 30);

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('CHAVE DE ACESSO', 14, 21);
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text(formatChaveAcesso(note.chave_acesso), 14, 27);

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('Nº', 14, 34);
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(note.numero_nota || '-', 22, 34);

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('SÉRIE', 60, 34);
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(note.serie || '-', 75, 34);

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('DATA EMISSÃO', 100, 34);
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(formatDateBR(note.data_emissao), 128, 34);

  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('NSU', 14, 42);
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text(note.nsu || '-', 26, 42);

  const statusText = (note.status || 'desconhecido').toUpperCase();
  const statusColor: [number, number, number] = note.status === 'ativa' ? [22, 163, 74] : note.status === 'cancelada' ? [220, 38, 38] : [156, 163, 175];
  doc.setFontSize(9);
  doc.setTextColor(...statusColor);
  doc.setFont(undefined as any, 'bold');
  doc.text(statusText, pageWidth - 14, 42, { align: 'right' });
  doc.setFont(undefined as any, 'normal');

  doc.setFillColor(240, 249, 255);
  doc.rect(10, 50, pageWidth - 20, 22, 'F');
  doc.setDrawColor(2, 132, 199);
  doc.rect(10, 50, pageWidth - 20, 22);

  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199);
  doc.setFont(undefined as any, 'bold');
  doc.text('EMITENTE', 14, 55);
  doc.setFont(undefined as any, 'normal');
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(note.emitente_nome || 'Não identificado', 14, 62);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`CNPJ: ${formatCNPJ(note.emitente_cnpj)}`, 14, 68);

  doc.setDrawColor(2, 132, 199);
  doc.rect(10, 76, pageWidth - 20, 14);
  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199);
  doc.setFont(undefined as any, 'bold');
  doc.text('DESTINATÁRIO', 14, 81);
  doc.setFont(undefined as any, 'normal');
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.text(`CNPJ: ${formatCNPJ(note.destinatario_cnpj)}`, 14, 87);

  doc.setFillColor(2, 132, 199);
  doc.rect(10, 94, pageWidth - 20, 12, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined as any, 'bold');
  doc.text('VALOR TOTAL DA NOTA FISCAL', 14, 100);
  doc.setFontSize(14);
  doc.text(formatCurrencyBR(note.valor_total), pageWidth - 14, 103, { align: 'right' });
  doc.setFont(undefined as any, 'normal');

  let yPos = 114;

  if (note.xml_completo) {
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(10, yPos, pageWidth - 10, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setTextColor(2, 132, 199);
    doc.setFont(undefined as any, 'bold');
    doc.text('INFORMAÇÕES COMPLEMENTARES', 14, yPos);
    doc.setFont(undefined as any, 'normal');
    yPos += 5;

    doc.setFontSize(6);
    doc.setTextColor(100);
    const xmlPreview = note.xml_completo.slice(0, 2000);
    const xmlLines = doc.splitTextToSize(xmlPreview, pageWidth - 28);
    const maxLines = Math.min(xmlLines.length, 40);
    for (let i = 0; i < maxLines; i++) {
      if (yPos > 280) {
        doc.addPage();
        yPos = 15;
      }
      doc.text(xmlLines[i], 14, yPos);
      yPos += 3;
    }
    if (xmlLines.length > maxLines) {
      doc.text('[... XML truncado ...]', 14, yPos);
      yPos += 5;
    }
  }

  if (linkedReceiptImageUrl) {
    doc.addPage();
    const pgW = doc.internal.pageSize.getWidth();

    doc.setFillColor(240, 249, 255);
    doc.rect(0, 0, pgW, 18, 'F');
    doc.setFontSize(11);
    doc.setTextColor(2, 132, 199);
    doc.setFont(undefined as any, 'bold');
    doc.text('COMPROVANTE DIGITALIZADO (RECIBO MANUAL)', pgW / 2, 12, { align: 'center' });
    doc.setFont(undefined as any, 'normal');

    try {
      const jpegData = await convertImageToJpegBase64(linkedReceiptImageUrl);
      const imgProps = doc.getImageProperties(jpegData);
      const maxW = pgW - 28;
      const maxH = doc.internal.pageSize.getHeight() - 40;
      let imgW = maxW;
      let imgH = (imgProps.height * imgW) / imgProps.width;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (imgProps.width * imgH) / imgProps.height;
      }
      const xOffset = (pgW - imgW) / 2;
      doc.addImage(jpegData, 'JPEG', xOffset, 22, imgW, imgH, undefined, 'FAST');
    } catch (e) {
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text('Não foi possível carregar a imagem do recibo.', pgW / 2, 30, { align: 'center' });
      console.error('Erro ao adicionar imagem ao DANFE:', e);
    }
  }

  const addFooter = () => {
    const fY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text('Documento gerado pelo NotasCD - Gestão Inteligente de Notas Fiscais', pageWidth / 2, fY, { align: 'center' });
  };
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter();
  }

  const fileName = `DANFE_${note.numero_nota || note.nsu || 'nota'}_${(note.emitente_nome || 'emitente').replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.pdf`;
  doc.save(fileName);
};

export const generateSefazReportPDF = async (
  notes: SefazNote[],
  categories: { id: string; name: string; color: string }[],
  location: string,
  periodLabel: string,
  categorySummary: { category: { name: string; color: string }; total: number; count: number }[],
  linkedReceiptImages?: Map<string, string>
) => {
  if (!window.jspdf) {
    alert("Biblioteca PDF não carregada. Verifique sua conexão.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(2, 132, 199);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Relatório SEFAZ - Notas Fiscais', 14, 16);

  doc.setFontSize(10);
  doc.text(`Unidade: ${location}`, 14, 24);
  doc.text(`Período: ${periodLabel}`, 14, 30);

  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 14, 30, { align: 'right' });

  const totalValue = notes.reduce((s, n) => s + (n.valor_total || 0), 0);
  const activeNotes = notes.filter(n => n.status === 'ativa').length;
  const cancelledNotes = notes.filter(n => n.status === 'cancelada').length;
  const linkedNotes = notes.filter(n => n.receipt_id).length;

  doc.setFillColor(240, 249, 255);
  doc.roundedRect(14, 40, pageWidth - 28, 22, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Total Gasto', 20, 47);
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(formatCurrencyBR(totalValue), 20, 56);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Qtd. Notas', 75, 47);
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`${notes.length}`, 75, 56);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Ativas / Canceladas', 115, 47);
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`${activeNotes} / ${cancelledNotes}`, 115, 56);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Vinculadas', 165, 47);
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`${linkedNotes}`, 165, 56);

  let yPos = 70;

  if (categorySummary.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont(undefined as any, 'bold');
    doc.text('Resumo por Categoria', 14, yPos);
    doc.setFont(undefined as any, 'normal');
    yPos += 3;

    const catTableData = categorySummary.map(item => [
      item.category.name,
      `${item.count}`,
      formatCurrencyBR(item.total),
      totalValue > 0 ? `${((item.total / totalValue) * 100).toFixed(1)}%` : '0%',
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Categoria', 'Qtd', 'Valor', '% do Total']],
      body: catTableData,
      theme: 'striped',
      headStyles: { fillColor: [2, 132, 199], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 20, halign: 'center' as const },
        2: { cellWidth: 45, halign: 'right' as const },
        3: { cellWidth: 30, halign: 'center' as const },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFont(undefined as any, 'bold');
  doc.text('Detalhamento das Notas', 14, yPos);
  doc.setFont(undefined as any, 'normal');
  yPos += 3;

  const getCatName = (note: SefazNote) => {
    if (note.category_id) {
      return categories.find(c => c.id === note.category_id)?.name || '-';
    }
    return '-';
  };

  const notesTableData = notes.map(note => [
    formatDateBR(note.data_emissao),
    (note.emitente_nome || '-').substring(0, 30),
    note.numero_nota || '-',
    note.status === 'ativa' ? 'Ativa' : note.status === 'cancelada' ? 'Cancelada' : note.status || '-',
    getCatName(note),
    formatCurrencyBR(note.valor_total),
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Data', 'Emitente', 'Nº', 'Status', 'Categoria', 'Valor']],
    body: notesTableData,
    theme: 'striped',
    headStyles: { fillColor: [2, 132, 199], fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 55 },
      2: { cellWidth: 18, halign: 'center' as const },
      3: { cellWidth: 22, halign: 'center' as const },
      4: { cellWidth: 30 },
      5: { cellWidth: 28, halign: 'right' as const },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      const footY = doc.internal.pageSize.getHeight() - 6;
      doc.setFontSize(6);
      doc.setTextColor(150);
      doc.text('Relatório gerado pelo NotasCD - Gestão Inteligente de Notas Fiscais', pageWidth / 2, footY, { align: 'center' });
    },
  });

  const footerY = doc.internal.pageSize.getHeight() - 6;
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text('Relatório gerado pelo NotasCD - Gestão Inteligente de Notas Fiscais', pageWidth / 2, footerY, { align: 'center' });

  if (linkedReceiptImages && linkedReceiptImages.size > 0) {
    const linkedNotes = notes.filter(n => n.receipt_id && linkedReceiptImages.has(n.receipt_id));
    for (const note of linkedNotes) {
      const imgUrl = linkedReceiptImages.get(note.receipt_id!);
      if (!imgUrl) continue;

      doc.addPage();
      let yImg = 14;

      doc.setFillColor(240, 249, 255);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setFontSize(9);
      doc.setTextColor(2, 132, 199);
      doc.setFont(undefined as any, 'bold');
      doc.text('COMPROVANTE VINCULADO', 14, 10);
      doc.setFont(undefined as any, 'normal');
      doc.setTextColor(0);
      doc.setFontSize(8);
      doc.text(`${note.emitente_nome || '-'} | Nº ${note.numero_nota || '-'} | ${formatDateBR(note.data_emissao)} | ${formatCurrencyBR(note.valor_total)}`, 14, 18);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(`Chave: ${note.chave_acesso || '-'}`, 14, 24);
      yImg = 32;

      try {
        const jpegData = await convertImageToJpegBase64(imgUrl);
        const imgProps = doc.getImageProperties(jpegData);
        const maxW = pageWidth - 28;
        const maxH = doc.internal.pageSize.getHeight() - yImg - 15;
        let imgW = maxW;
        let imgH = (imgProps.height * imgW) / imgProps.width;
        if (imgH > maxH) {
          imgH = maxH;
          imgW = (imgProps.width * imgH) / imgProps.height;
        }
        const xOffset = (pageWidth - imgW) / 2;
        doc.addImage(jpegData, 'JPEG', xOffset, yImg, imgW, imgH, undefined, 'FAST');
      } catch (e) {
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text('Não foi possível carregar a imagem do recibo.', pageWidth / 2, yImg + 10, { align: 'center' });
        console.error('Erro ao adicionar imagem ao relatório:', e);
      }
    }
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footY2 = doc.internal.pageSize.getHeight() - 6;
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text('Relatório gerado pelo NotasCD - Gestão Inteligente de Notas Fiscais', pageWidth / 2, footY2, { align: 'center' });
  }

  const safeLocation = location.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`relatorio_sefaz_${safeLocation}_${new Date().toISOString().slice(0, 10)}.pdf`);
};