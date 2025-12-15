# Database Schema Migration Guide

## ⚠️ Required: Update Appwrite Collection

The auto-save feature requires **3 new fields** to be added to your Appwrite `carousels` collection.

---

## 🔧 Step-by-Step Instructions

### 1. Access Appwrite Console

1. Go to your Appwrite Console: https://cloud.appwrite.io/console
2. Navigate to your project
3. Go to **Databases** → **main** (your database)
4. Select the **carousels** collection

---

### 2. Add New Attributes

You need to add **3 new attributes** to the collection:

#### Attribute 1: selectedPattern

| Setting | Value |
|---------|-------|
| **Key** | `selectedPattern` |
| **Type** | Integer |
| **Size** | Default |
| **Required** | ✅ Yes |
| **Array** | ❌ No |
| **Default** | `1` |
| **Min** | `1` |
| **Max** | `12` |

**Steps:**
1. Click "Create Attribute"
2. Select "Integer"
3. Set Key to `selectedPattern`
4. Check "Required"
5. Set Default to `1`
6. Set Min to `1`, Max to `12`
7. Click "Create"

---

#### Attribute 2: patternOpacity

| Setting | Value |
|---------|-------|
| **Key** | `patternOpacity` |
| **Type** | Float (Double) |
| **Size** | Default |
| **Required** | ✅ Yes |
| **Array** | ❌ No |
| **Default** | `0.2` |
| **Min** | `0` |
| **Max** | `1` |

**Steps:**
1. Click "Create Attribute"
2. Select "Float" or "Double"
3. Set Key to `patternOpacity`
4. Check "Required"
5. Set Default to `0.2`
6. Set Min to `0`, Max to `1`
7. Click "Create"

---

#### Attribute 3: branding

| Setting | Value |
|---------|-------|
| **Key** | `branding` |
| **Type** | String |
| **Size** | 10000 (to store JSON) |
| **Required** | ✅ Yes |
| **Array** | ❌ No |
| **Default** | `{"enabled":true,"name":"","title":"","imageUrl":"","position":"bottom-left"}` |

**Steps:**
1. Click "Create Attribute"
2. Select "String"
3. Set Key to `branding`
4. Set Size to `10000`
5. Check "Required"
6. Set Default to: 
   ```json
   {"enabled":true,"name":"","title":"","imageUrl":"","position":"bottom-left"}
   ```
7. Click "Create"

---

### 3. Wait for Indexing

After adding each attribute, Appwrite will re-index the collection. Wait for all attributes to finish indexing before testing.

---

### 4. Verify Schema

Your `carousels` collection should now have these attributes:

**Existing:**
- ✅ userId (string)
- ✅ title (string)
- ✅ templateType (string)
- ✅ theme (string, JSON)
- ✅ slides (string, JSON)
- ✅ presetId (string)
- ✅ isPublic (boolean)
- ✅ format (string)

**New:**
- ✅ selectedPattern (integer)
- ✅ patternOpacity (float)
- ✅ branding (string, JSON)

---

## 🧪 Test After Migration

1. Refresh your application
2. Generate a new carousel
3. Wait 2 seconds
4. You should see "Auto-saved" badge
5. Check the database - new carousel should have all fields

---

## 🔄 Handling Existing Data

Existing carousels in your database will automatically get the default values:
- `selectedPattern`: 1
- `patternOpacity`: 0.2
- `branding`: Empty signature (disabled)

When users edit old carousels, they can customize these values and they'll be saved.

---

## 📸 Quick Visual Reference

```
Appwrite Console Flow:
1. Databases → main
2. Collections → carousels  
3. Attributes tab
4. Create Attribute (×3 times)
5. Wait for indexing
6. Done! ✅
```

---

## ❓ Troubleshooting

**Error still occurs after adding attributes?**
- Clear browser cache and reload
- Make sure all 3 attributes finished indexing
- Check attribute keys match exactly (case-sensitive)

**Can't add attributes?**
- Ensure you have admin/owner permissions
- Check if collection is locked or read-only

**Need to rollback?**
- Simply delete the 3 new attributes
- App will fall back gracefully (won't crash)

---

## ✅ Once Complete

After successfully adding these attributes, the auto-save feature will work perfectly:
- New carousels will save automatically
- All customizations preserved
- Limit enforcement active
- Status badges functional

Let me know once you've added the attributes and I can help test!
