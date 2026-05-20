// This is a Prisma schema migration to support many-to-many products ↔ colors
// Run: npx prisma migrate dev --name add_color_table_and_product_color_junction

/\*
Add to schema.prisma:

model Color {
id String @id @default(cuid())
colorName String
colorCode String?
baseType ColorBaseType
isTinted Boolean @default(false)

productColors ProductColor[]

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@unique([colorName, baseType])
@@index([colorName])
}

model ProductColor {
id String @id @default(cuid())
productId String
colorId String

product ProcurementProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
color Color @relation(fields: [colorId], references: [id], onDelete: Cascade)

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@unique([productId, colorId])
@@index([productId])
@@index([colorId])
}

// Update ProcurementProduct to remove direct color variants:
// Remove: colorVariants ProductColorVariant[]
// Add: productColors ProductColor[]

// Keep ProductColorVariant for backward compatibility but mark as deprecated
\*/
